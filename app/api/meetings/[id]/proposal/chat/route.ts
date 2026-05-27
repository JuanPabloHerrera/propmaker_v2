import { createClient } from '@/lib/supabase/server'
import { streamPostMeetingChat, generateProposal } from '@/lib/claude'
import { tiptapToText } from '@/lib/tiptap'
import { markdownToTiptap } from '@/lib/markdown'
import { NextResponse } from 'next/server'
import type { Meeting, MeetingType, Product, TranscriptSegment } from '@/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meeting } = await supabase
    .from('meetings')
    .select('meeting_type, notes_json, selected_categories')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userMessage } = await request.json()

  // Build partitioned transcripts (browser = primary, recall = fallback)
  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('speaker, text, source')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })

  const rows = (segments as Pick<TranscriptSegment, 'speaker' | 'text' | 'source'>[] | null) ?? []
  const formatSeg = (s: { speaker: string | null; text: string }) =>
    `${s.speaker ?? 'Speaker'}: ${s.text}`
  const browserTranscript = rows.filter((s) => s.source === 'browser').map(formatSeg).join('\n')
  const recallTranscript = rows.filter((s) => s.source === 'recall').map(formatSeg).join('\n')

  // Notes (Tiptap JSON → plain text)
  const notesText = tiptapToText((meeting as Pick<Meeting, 'notes_json'>).notes_json)

  // Catalog filtered by selected categories (empty array = all active products)
  const selected = (meeting as Pick<Meeting, 'selected_categories'>).selected_categories ?? []
  let productsQuery = supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
  if (selected.length > 0) productsQuery = productsQuery.in('category', selected)
  const { data: productsData } = await productsQuery
  const products = (productsData ?? []) as Product[]

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

  if (userMessage) {
    await supabase.from('post_meeting_chat').insert({
      meeting_id: id,
      role: 'user',
      content: userMessage,
    })
    chatHistory.push({ role: 'user', content: userMessage })
  }

  // Replay last assistant message if user just reopened the page
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

  const stream = streamPostMeetingChat({
    browserTranscript,
    recallTranscript,
    notesText,
    products,
    chatHistory,
    liveChatHistory,
  })

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

      await supabase.from('post_meeting_chat').insert({
        meeting_id: id,
        role: 'assistant',
        content: fullText,
      })

      if (fullText.includes('[READY_TO_GENERATE]')) {
        const cleanedHistory = [...chatHistory, { role: 'assistant' as const, content: fullText }]
        const proposalMarkdown = await generateProposal({
          browserTranscript,
          recallTranscript,
          notesText,
          products,
          chatHistory: cleanedHistory,
          liveChatHistory,
          meetingType: meeting.meeting_type as MeetingType,
        })

        // Persist before signalling the client so the proposal page can
        // read it on first load — the QA page redirects immediately and
        // the markdown would otherwise vanish.
        const content_json = markdownToTiptap(proposalMarkdown)
        const { data: existing } = await supabase
          .from('proposals')
          .select('id')
          .eq('meeting_id', id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('proposals')
            .update({ content_json })
            .eq('id', existing.id)
        } else {
          await supabase.from('proposals').insert({
            meeting_id: id,
            user_id: user.id,
            content_json,
            status: 'draft',
          })
        }

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
