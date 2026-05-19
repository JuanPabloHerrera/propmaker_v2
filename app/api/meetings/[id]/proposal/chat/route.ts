import { createClient } from '@/lib/supabase/server'
import { streamPostMeetingChat, generateProposal } from '@/lib/claude'
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

  const { userMessage } = await request.json()

  // Build transcript
  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('speaker, text')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })

  const transcript = (segments as TranscriptSegment[] | null)
    ?.map((s) => `${s.speaker ?? 'Speaker'}: ${s.text}`)
    .join('\n') ?? ''

  // Fetch existing chat history
  const { data: existingChat } = await supabase
    .from('post_meeting_chat')
    .select('role, content')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })

  const chatHistory = (existingChat ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>

  // Fetch in-meeting co-pilot conversation
  const { data: liveChat } = await supabase
    .from('live_meeting_chat')
    .select('role, content')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })

  const liveChatHistory = (liveChat ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>

  // Save user's new message if provided
  if (userMessage) {
    await supabase.from('post_meeting_chat').insert({
      meeting_id: id,
      role: 'user',
      content: userMessage,
    })
    chatHistory.push({ role: 'user', content: userMessage })
  }

  // If no user message and history already ends with assistant, avoid sending invalid messages to Claude
  // (happens when user refreshes and clicks Start Q&A again)
  if (!userMessage && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'assistant') {
    const lastAssistantMsg = chatHistory[chatHistory.length - 1].content
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: lastAssistantMsg })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } }
    )
  }

  // Stream Claude's response
  const stream = streamPostMeetingChat(transcript, chatHistory, liveChatHistory)

  let fullText = ''
  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          fullText += text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
      }

      // Save Claude's full response
      await supabase.from('post_meeting_chat').insert({
        meeting_id: id,
        role: 'assistant',
        content: fullText,
      })

      // If Claude signals it's ready to generate proposal
      if (fullText.includes('[READY_TO_GENERATE]')) {
        const cleanedHistory = [...chatHistory, { role: 'assistant' as const, content: fullText }]
        const proposalMarkdown = await generateProposal(
          transcript,
          cleanedHistory,
          meeting.meeting_type as MeetingType,
          liveChatHistory
        )
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ proposal: proposalMarkdown })}\n\n`)
        )
      }

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
