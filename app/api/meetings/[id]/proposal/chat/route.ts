import { createClient } from '@/lib/supabase/server'
import { streamPostMeetingChat } from '@/lib/claude'
import { gatherMeetingInputs } from '@/lib/meeting-inputs'
import { NextResponse } from 'next/server'

// Post-meeting Q&A stream. This route ONLY conducts the gap-filling Q&A. When
// the agent is done (or the consultant skips), it signals `{ toBrief: true }`
// and the client advances to the /brief screen, where the prioritized synthesis
// is generated and reviewed before the proposal itself is written.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inputs = await gatherMeetingInputs(supabase, id, user.id)
  if (!inputs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const {
    browserTranscript,
    recallTranscript,
    notesText,
    products,
    referenceProposals,
    chatHistory,
    liveChatHistory,
    aiSuggestions,
  } = inputs

  const { userMessage, generate } = await request.json()

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
  const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  }

  // Deterministic skip — the consultant clicked "Skip questions" / "Continue".
  // No proposal is generated here anymore; hand off to the /brief review step.
  if (generate) {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(sse({ toBrief: true }))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      }),
      { headers: sseHeaders },
    )
  }

  // Replay last assistant message if the user just reopened the page.
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
      { headers: sseHeaders },
    )
  }

  const stream = streamPostMeetingChat({
    browserTranscript,
    recallTranscript,
    notesText,
    products,
    chatHistory,
    liveChatHistory,
    aiSuggestions,
    referenceProposals,
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

      // The agent has enough — advance the client to the brief review step.
      if (fullText.includes('[READY_TO_GENERATE]')) {
        controller.enqueue(sse({ toBrief: true }))
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readableStream, { headers: sseHeaders })
}
