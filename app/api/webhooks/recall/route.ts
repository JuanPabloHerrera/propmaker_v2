import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse, after } from 'next/server'
import { generateSuggestions } from '@/lib/claude'
import { runMeetingExtraction } from '@/lib/extract-meeting'
import { getTranscriptById } from '@/lib/recall'
import type { MeetingType, TranscriptSegment } from '@/types'

export const dynamic = 'force-dynamic'

// Words accumulated per meeting before triggering a new suggestions pass
const SUGGESTION_WORD_THRESHOLD = 40

export async function POST(request: Request) {
  const body = await request.json()
  const supabase = createServiceClient()

  const eventType: string = body.event ?? body.data?.event ?? ''
  const bot = body.data?.bot ?? body.bot ?? {}
  const botId: string = bot.id ?? ''
  // We stamp the meeting id into the bot's metadata when creating it (createBot in
  // lib/recall.ts), and Recall echoes it back on every webhook. Matching on this is
  // more reliable than the bot id — it survives any payload-shape quirk in bot-id
  // extraction and any race where recall_bot_id hasn't been persisted yet.
  const metaMeetingId: string = bot.metadata?.meeting_id ?? ''

  console.log(`[webhook] event=${eventType} botId=${botId} metaMeetingId=${metaMeetingId} keys=${Object.keys(body).join(',')}`)
  console.log(`[webhook] body=${JSON.stringify(body).slice(0, 500)}`)

  if (!botId && !metaMeetingId) {
    console.warn(`[webhook] no botId or meeting_id in payload — event=${eventType}`)
    return NextResponse.json({ ok: true })
  }

  // Resolve the meeting: prefer recall_bot_id, fall back to the meeting id carried
  // in bot metadata so a bot-id mismatch alone never drops the transcript.
  async function resolveMeeting() {
    if (botId) {
      const { data } = await supabase
        .from('meetings')
        .select('id, meeting_type')
        .eq('recall_bot_id', botId)
        .maybeSingle()
      if (data) return data
    }
    if (metaMeetingId) {
      const { data } = await supabase
        .from('meetings')
        .select('id, meeting_type')
        .eq('id', metaMeetingId)
        .maybeSingle()
      if (data) return data
    }
    return null
  }

  const meeting = await resolveMeeting()

  if (!meeting) {
    // A webhook that reaches us but matches no meeting means the bot was created
    // against a different deployment/region than this one — surface it instead of
    // silently 200-ing, so a misrouted webhook is visible in logs.
    console.warn(
      `[webhook] no meeting resolved — botId=${botId} metaMeetingId=${metaMeetingId} event=${eventType}`,
    )
    return NextResponse.json({ ok: true })
  }

  const meetingId: string = meeting.id

  // --- Partial (interim) transcript: stream live word-by-word, don't persist ---
  if (eventType === 'transcript.partial_data') {
    const words: Array<{ text: string }> = body.data?.data?.words ?? []
    const text = words.map((w) => w.text).join(' ').trim()
    if (text) {
      await supabase.from('meetings').update({ live_partial: text }).eq('id', meetingId)
    }
    return NextResponse.json({ ok: true })
  }

  // --- Real-time transcript event ---
  if (eventType === 'transcript.data' || body.transcript) {
    // realtime_endpoints format: { data: { data: { words, participant }, is_final } }
    // legacy format: { words, speaker }
    const rtData = body.data?.data ?? {}
    const words: Array<{ text: string; start_time?: number; start_timestamp?: { relative: number } }> =
      rtData.words ?? body.words ?? body.transcript?.words ?? []

    if (words.length > 0) {
      const speaker: string =
        rtData.participant?.name ?? body.speaker ?? body.transcript?.speaker ?? 'Speaker'
      const text = words.map((w) => w.text).join(' ')
      const startTime: number =
        words[0]?.start_timestamp?.relative ?? words[0]?.start_time ?? 0

      const { error: insertErr } = await supabase.from('transcript_segments').insert({
        meeting_id: meetingId,
        speaker,
        text,
        start_time: startTime,
        source: 'recall',
      })
      if (insertErr) {
        console.error(`[webhook] segment insert failed meeting=${meetingId}: ${insertErr.message}`)
      }

      // The finalized utterance is now a segment — clear the live interim line.
      await supabase.from('meetings').update({ live_partial: null }).eq('id', meetingId)

      // Regenerate suggestions off the response path: the Claude call must not
      // block this webhook, or Recall (which delivers webhooks serially) stalls
      // the transcript stream and it arrives in bursts.
      after(async () => {
        const { count } = await supabase
          .from('transcript_segments')
          .select('id', { count: 'exact', head: true })
          .eq('meeting_id', meetingId)

        const { data: lastSuggestion } = await supabase
          .from('suggestions')
          .select('created_at')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        const { data: newSegments } = await supabase
          .from('transcript_segments')
          .select('text')
          .eq('meeting_id', meetingId)
          .gt('created_at', lastSuggestion?.created_at ?? '1970-01-01')

        const newWordCount = newSegments?.reduce((acc, s) => acc + s.text.split(' ').length, 0) ?? 0

        if (newWordCount >= SUGGESTION_WORD_THRESHOLD || count === 1) {
          const { data: allSegments } = await supabase
            .from('transcript_segments')
            .select('speaker, text')
            .eq('meeting_id', meetingId)
            .order('created_at', { ascending: true })

          const transcript = (allSegments as TranscriptSegment[] | null)
            ?.map((s) => `${s.speaker ?? 'Speaker'}: ${s.text}`)
            .join('\n') ?? ''

          const questions = await generateSuggestions(transcript, meeting.meeting_type as MeetingType)
          await supabase.from('suggestions').insert({ meeting_id: meetingId, questions })
        }
      })
    }
  }

  // --- Transcript done: save segments + suggestions + complete meeting ---
  if (eventType === 'transcript.done') {
    const transcriptId: string = body.data?.transcript?.id ?? ''
    if (transcriptId) {
      const segments = await getTranscriptById(transcriptId)
      if (segments.length > 0) {
        // Delete only recall-sourced segments so we don't wipe browser-captured
        // ones (the `both` capture mode keeps both streams).
        await supabase
          .from('transcript_segments')
          .delete()
          .eq('meeting_id', meetingId)
          .eq('source', 'recall')

        const rows = segments.map((seg) => ({
          meeting_id: meetingId,
          speaker: seg.speaker ?? 'Speaker',
          text: seg.words.map((w) => w.text).join(' '),
          start_time: seg.words[0]?.start_time ?? 0,
          source: 'recall' as const,
        }))
        const { error: doneInsertErr } = await supabase.from('transcript_segments').insert(rows)
        if (doneInsertErr) {
          console.error(`[webhook] transcript.done insert failed meeting=${meetingId}: ${doneInsertErr.message}`)
        }

        const fullText = rows.map((r) => `${r.speaker}: ${r.text}`).join('\n')
        after(async () => {
          const { data: mtg } = await supabase.from('meetings').select('meeting_type').eq('id', meetingId).single()
          const questions = await generateSuggestions(fullText, (mtg?.meeting_type ?? 'consulting') as MeetingType)
          await supabase.from('suggestions').insert({ meeting_id: meetingId, questions })
        })
      }
    }

    // Mark the recall transcript as ready so the Processing screen can advance.
    // Only flip this here (transcript.done) — never in the bot.done branch, which
    // can fire before the transcript is actually delivered.
    await supabase
      .from('meetings')
      .update({ status: 'completed', live_partial: null, recall_transcript_ready: true })
      .eq('id', meetingId)

    // The authoritative transcript just landed — extract title/client/attendees/
    // context/language off the response path (idempotent across trigger paths).
    after(() => runMeetingExtraction(supabase, meetingId))
  }

  // --- Bot status events ---
  if (eventType === 'bot.status_change' || eventType === 'bot.done') {
    const statusCode: string = body.data?.status?.code ?? body.status?.code ?? eventType

    if (['done', 'call_ended', 'bot.done'].includes(statusCode)) {
      await supabase
        .from('meetings')
        .update({ status: 'completed', live_partial: null })
        .eq('id', meetingId)
    }
  }

  return NextResponse.json({ ok: true })
}
