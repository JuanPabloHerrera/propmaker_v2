import { extractMeetingMetadata } from '@/lib/claude'
import { getBot } from '@/lib/recall'
import type { createServiceClient } from '@/lib/supabase/server'
import type { Meeting } from '@/types'

type AnyClient = ReturnType<typeof createServiceClient>

/** True when the title is still one of the server-generated placeholders. */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  if (!title) return true
  return title === 'Untitled meeting' || title.startsWith('Meeting — ')
}

/**
 * Post-meeting metadata extraction: fills title (when still a placeholder),
 * client_company, attendees, context_summary, and language from the transcript.
 *
 * Idempotent via `meetings.metadata_extracted_at` — it is triggered from three
 * paths (meeting PATCH on completion, the Recall transcript.done webhook, and
 * the processing screen's fallback) and must only pay for one Claude call.
 * Works with either the service client or a user-scoped client.
 */
export async function runMeetingExtraction(
  supabase: AnyClient,
  meetingId: string,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const { data: meeting } = await supabase
    .from('meetings')
    .select(
      'id, title, client_company, attendees, context_summary, language, metadata_extracted_at, recall_bot_id, notes_json',
    )
    .eq('id', meetingId)
    .single()
  if (!meeting) return

  const m = meeting as Pick<
    Meeting,
    | 'id'
    | 'title'
    | 'client_company'
    | 'attendees'
    | 'context_summary'
    | 'language'
    | 'metadata_extracted_at'
    | 'recall_bot_id'
    | 'notes_json'
  >

  if (m.metadata_extracted_at && !force) return

  // Claim the run up front so a concurrent trigger sees the guard and bails —
  // extraction is best-effort, so losing a race beats double-paying Claude.
  if (force) {
    await supabase
      .from('meetings')
      .update({ metadata_extracted_at: new Date().toISOString() })
      .eq('id', meetingId)
  } else {
    const { data: claimed } = await supabase
      .from('meetings')
      .update({ metadata_extracted_at: new Date().toISOString() })
      .eq('id', meetingId)
      .is('metadata_extracted_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) return
  }

  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('speaker, text, source')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })
  const rows = (segments ?? []) as Array<{ speaker: string | null; text: string; source: string }>
  const formatSeg = (s: { speaker: string | null; text: string }) =>
    `${s.speaker ?? 'Speaker'}: ${s.text}`
  const browserTranscript = rows.filter((s) => s.source === 'browser').map(formatSeg).join('\n')
  const recallTranscript = rows.filter((s) => s.source === 'recall').map(formatSeg).join('\n')

  const { tiptapToText } = await import('@/lib/tiptap')
  const notesText = tiptapToText(m.notes_json)

  const extracted = await extractMeetingMetadata({
    browserTranscript,
    recallTranscript,
    notesText,
  })

  // Best-effort Recall meeting title — platform-dependent and usually absent.
  let recallTitle: string | null = null
  if (m.recall_bot_id) {
    try {
      const bot = await getBot(m.recall_bot_id)
      recallTitle = bot.meeting_metadata?.title?.trim() || null
    } catch {
      recallTitle = null
    }
  }

  // Only overwrite fields the user hasn't already filled in.
  const update: Record<string, unknown> = {}
  if (isPlaceholderTitle(m.title)) {
    const title = recallTitle ?? extracted.title
    if (title) update.title = title.slice(0, 120)
  }
  if (!m.client_company && extracted.client_company) update.client_company = extracted.client_company
  if ((!m.attendees || m.attendees.length === 0) && extracted.attendees.length > 0)
    update.attendees = extracted.attendees
  if (!m.context_summary && extracted.context_summary) update.context_summary = extracted.context_summary
  if (extracted.language && (force || !m.language)) update.language = extracted.language

  if (Object.keys(update).length > 0) {
    await supabase.from('meetings').update(update).eq('id', meetingId)
  }
}
