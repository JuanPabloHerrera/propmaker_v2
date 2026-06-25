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
    .select('meeting_type, notes_json, selected_categories, attached_product_ids, detected_product_ids')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userMessage, generate } = await request.json()

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

  // Catalog: union of (products in selected categories) ∪ (explicitly
  // attached) ∪ (auto-detected from transcript). selected_categories
  // is a filter; attached + detected are explicit IDs that always
  // make it into the catalog even if their category was unchecked.
  const m = meeting as Pick<
    Meeting,
    'selected_categories' | 'attached_product_ids' | 'detected_product_ids'
  >
  const selected = m.selected_categories ?? []
  const explicitIds = Array.from(
    new Set([...(m.attached_product_ids ?? []), ...(m.detected_product_ids ?? [])]),
  )

  let productsQuery = supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
  if (selected.length > 0 && explicitIds.length > 0) {
    productsQuery = productsQuery.or(
      `category.in.(${selected.map((c) => `"${c}"`).join(',')}),id.in.(${explicitIds.join(',')})`,
    )
  } else if (selected.length > 0) {
    productsQuery = productsQuery.in('category', selected)
  } else if (explicitIds.length > 0) {
    // When no category filter is set, we still load everything so the
    // model has the full catalog — explicit IDs are guaranteed to be
    // inside it.
  }
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

  const encoder = new TextEncoder()
  const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)

  // Generate the proposal markdown, persist it (upsert), return the markdown.
  // Shared by the deterministic "generate" path and the [READY_TO_GENERATE] path.
  const persistProposal = async (
    historyForGen: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string> => {
    const proposalMarkdown = await generateProposal({
      browserTranscript,
      recallTranscript,
      notesText,
      products,
      chatHistory: historyForGen,
      liveChatHistory,
      meetingType: meeting.meeting_type as MeetingType,
    })
    const content_json = markdownToTiptap(proposalMarkdown)
    const { data: existing } = await supabase
      .from('proposals')
      .select('id')
      .eq('meeting_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) {
      await supabase.from('proposals').update({ content_json }).eq('id', existing.id)
    } else {
      await supabase.from('proposals').insert({
        meeting_id: id,
        user_id: user.id,
        content_json,
        status: 'draft',
      })
    }
    return proposalMarkdown
  }

  // Deterministic generation — bypass the Q&A model entirely and build the
  // proposal from whatever context exists. Triggered by "Skip questions" /
  // "Generate proposal now".
  if (generate) {
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const proposalMarkdown = await persistProposal(chatHistory)
            controller.enqueue(sse({ proposal: proposalMarkdown }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate proposal'
            console.error('[proposal/chat generate]', message)
            controller.enqueue(sse({ error: message }))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      },
    )
  }

  // Replay last assistant message if user just reopened the page
  if (
    !userMessage &&
    !generate &&
    chatHistory.length > 0 &&
    chatHistory[chatHistory.length - 1].role === 'assistant'
  ) {
    const lastAssistantMsg = chatHistory[chatHistory.length - 1].content
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(sse({ text: lastAssistantMsg }))
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
        // Persist before signalling the client so the proposal page can
        // read it on first load — the QA page redirects immediately and
        // the markdown would otherwise vanish.
        const proposalMarkdown = await persistProposal([
          ...chatHistory,
          { role: 'assistant' as const, content: fullText },
        ])
        controller.enqueue(sse({ proposal: proposalMarkdown }))
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
