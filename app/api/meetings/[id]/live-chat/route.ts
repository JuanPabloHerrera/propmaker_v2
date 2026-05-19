import { createClient } from '@/lib/supabase/server'
import { streamLiveChat } from '@/lib/claude'
import { NextResponse } from 'next/server'
import type { MeetingType, TranscriptSegment } from '@/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { userMessage, chatHistory } = await request.json()

  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('speaker, text')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })

  const transcript = (segments as TranscriptSegment[] | null)
    ?.map((s) => `${s.speaker ?? 'Speaker'}: ${s.text}`)
    .join('\n') ?? ''

  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(chatHistory ?? []),
    { role: 'user', content: userMessage },
  ]

  await supabase.from('live_meeting_chat').insert({
    meeting_id: id,
    role: 'user',
    content: userMessage,
  })

  const stream = streamLiveChat(transcript, history, meeting.meeting_type as MeetingType)

  const encoder = new TextEncoder()
  let fullText = ''
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
        }
      }
      await supabase.from('live_meeting_chat').insert({
        meeting_id: id,
        role: 'assistant',
        content: fullText,
      })
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
