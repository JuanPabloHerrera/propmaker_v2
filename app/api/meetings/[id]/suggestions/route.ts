import { createClient } from '@/lib/supabase/server'
import { generateSuggestions } from '@/lib/claude'
import { NextResponse } from 'next/server'
import type { MeetingType, TranscriptSegment } from '@/types'

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

  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('speaker, text')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })

  const transcript = (segments as TranscriptSegment[] | null)
    ?.map((s) => `${s.speaker ?? 'Speaker'}: ${s.text}`)
    .join('\n') ?? ''

  if (!transcript.trim()) {
    return NextResponse.json({ questions: [] })
  }

  const questions = await generateSuggestions(transcript, meeting.meeting_type as MeetingType)

  const { data: suggestion } = await supabase
    .from('suggestions')
    .insert({ meeting_id: id, questions })
    .select()
    .single()

  return NextResponse.json(suggestion)
}
