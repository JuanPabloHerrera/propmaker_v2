import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamDocumentRefine, type RefineMode } from '@/lib/claude'
import { tiptapToMarkdown } from '@/lib/tiptap'
import { markdownToTiptap } from '@/lib/markdown'
import type { MeetingDocument, MeetingType, Product } from '@/types'

interface RefineBody {
  mode: RefineMode
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}

/** Refine drawer for any document type — chat about changes or apply a rewrite. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as RefineBody
  if (!body.mode || !Array.isArray(body.history)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { data: document } = await supabase
    .from('meeting_documents')
    .select('id, doc_type, content_json, meeting_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const doc = document as Pick<MeetingDocument, 'id' | 'doc_type' | 'content_json' | 'meeting_id'>
  const currentMarkdown = tiptapToMarkdown(doc.content_json)

  const { data: meeting } = await supabase
    .from('meetings')
    .select('meeting_type')
    .eq('id', doc.meeting_id)
    .maybeSingle()
  const meetingType = ((meeting?.meeting_type as MeetingType | undefined) ?? 'consulting') as MeetingType

  // Catalog + references only matter for proposals — the generator skips them
  // for minutes/summaries, so skip the queries too.
  let products: Product[] = []
  let referenceProposals: Array<{ title: string; summary: string }> = []
  if (doc.doc_type === 'proposal') {
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
    products = (productsData ?? []) as Product[]

    const { data: refData } = await supabase
      .from('reference_proposals')
      .select('title, summary')
      .eq('user_id', user.id)
      // Style templates (pptx) carry no useful text — keep them out of the prompt.
      .in('source', ['uploaded', 'app_proposal'])
      .order('created_at', { ascending: false })
      .limit(8)
    referenceProposals = (refData ?? []) as Array<{ title: string; summary: string }>
  }

  const stream = streamDocumentRefine({
    mode: body.mode,
    docType: doc.doc_type,
    currentMarkdown,
    history: body.history,
    products,
    meetingType,
    referenceProposals,
  })

  const encoder = new TextEncoder()
  let fullText = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text
            fullText += text
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
            )
          }
        }

        if (body.mode === 'apply' && fullText.trim().length > 0) {
          const content_json = markdownToTiptap(fullText.trim())
          await supabase
            .from('meeting_documents')
            .update({ content_json })
            .eq('id', doc.id)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ applied: true })}\n\n`),
          )
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream failed' })}\n\n`,
          ),
        )
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
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
