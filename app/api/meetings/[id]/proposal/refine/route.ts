import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamProposalRefine, type RefineMode } from '@/lib/claude'
import { tiptapToMarkdown } from '@/lib/tiptap'
import { markdownToTiptap } from '@/lib/markdown'
import type { Meeting, MeetingType, Product, Proposal } from '@/types'

interface RefineBody {
  mode: RefineMode
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}

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

  const { data: meeting } = await supabase
    .from('meetings')
    .select('meeting_type, selected_categories, attached_product_ids, detected_product_ids')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, content_json')
    .eq('meeting_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!proposal) {
    return NextResponse.json(
      { error: 'No proposal exists yet for this meeting.' },
      { status: 404 },
    )
  }

  const currentMarkdown = tiptapToMarkdown(
    (proposal as Pick<Proposal, 'content_json'>).content_json,
  )

  // Catalog: union of selected-category products, attached, and detected.
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
  }
  const { data: productsData } = await productsQuery
  const products = (productsData ?? []) as Product[]

  const stream = streamProposalRefine({
    mode: body.mode,
    currentMarkdown,
    history: body.history,
    products,
    meetingType: (meeting as Pick<Meeting, 'meeting_type'>).meeting_type as MeetingType,
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
            .from('proposals')
            .update({ content_json })
            .eq('id', (proposal as Pick<Proposal, 'id'>).id)
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
