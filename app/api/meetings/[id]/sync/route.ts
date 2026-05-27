import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getBotTranscript } from '@/lib/recall'
import { generateSuggestions } from '@/lib/claude'
import { NextResponse } from 'next/server'
import type { MeetingType } from '@/types'

// Pulls the full transcript from Recall.ai and saves it to Supabase.
// Used when webhooks aren't available (e.g. localhost dev).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meeting } = await supabase
    .from('meetings')
    .select('recall_bot_id, meeting_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!meeting?.recall_bot_id) {
    return NextResponse.json({ error: 'No bot associated with this meeting' }, { status: 400 })
  }

  const segments = await getBotTranscript(meeting.recall_bot_id)

  if (segments.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  const serviceSupabase = createServiceClient()

  // Clear only Recall-sourced segments — preserve any browser-captured ones
  await serviceSupabase
    .from('transcript_segments')
    .delete()
    .eq('meeting_id', id)
    .eq('source', 'recall')

  const rows = segments.map((seg) => ({
    meeting_id: id,
    speaker: seg.speaker ?? 'Speaker',
    text: seg.words.map((w) => w.text).join(' '),
    start_time: seg.words[0]?.start_time ?? 0,
    source: 'recall' as const,
  }))

  await serviceSupabase.from('transcript_segments').insert(rows)

  // Generate fresh suggestions from full transcript
  const fullText = rows.map((r) => `${r.speaker}: ${r.text}`).join('\n')
  const questions = await generateSuggestions(fullText, meeting.meeting_type as MeetingType)
  await serviceSupabase.from('suggestions').insert({ meeting_id: id, questions })

  return NextResponse.json({ synced: rows.length })
}
