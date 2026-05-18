import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateSuggestions } from '@/lib/claude'
import type { MeetingType, TranscriptSegment } from '@/types'

const SUGGESTION_WORD_THRESHOLD = 40

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meeting } = await supabase
    .from('meetings')
    .select('meeting_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lastSuggestion } = await supabase
    .from('suggestions')
    .select('created_at')
    .eq('meeting_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: newSegments } = await supabase
    .from('transcript_segments')
    .select('text')
    .eq('meeting_id', id)
    .gt('created_at', lastSuggestion?.created_at ?? '1970-01-01')

  const newWordCount = newSegments?.reduce((acc, s) => acc + s.text.split(' ').length, 0) ?? 0

  if (newWordCount < SUGGESTION_WORD_THRESHOLD) {
    return NextResponse.json({ ok: true, generated: false })
  }

  const { data: allSegments } = await supabase
    .from('transcript_segments')
    .select('speaker, text')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })

  const transcript = (allSegments as TranscriptSegment[] | null)
    ?.map((s) => `${s.speaker ?? 'Speaker'}: ${s.text}`)
    .join('\n') ?? ''

  const questions = await generateSuggestions(transcript, meeting.meeting_type as MeetingType)
  await supabase.from('suggestions').insert({ meeting_id: id, questions })

  return NextResponse.json({ ok: true, generated: true })
}
