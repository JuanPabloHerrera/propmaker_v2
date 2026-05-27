import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectProductsInTranscript } from '@/lib/products'
import type { Meeting, Product, TranscriptSegment } from '@/types'

/**
 * Run product detection against the meeting transcript + the user's
 * active catalog. Persists the matched ids to `meetings.detected_product_ids`
 * and returns the full product rows so the Q&A UI can render them.
 *
 * Cached: re-runs unconditionally so the consultant can re-detect
 * after editing notes / adding catalog items.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meeting } = await supabase
    .from('meetings')
    .select('attached_product_ids, detected_product_ids')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const m = meeting as Pick<Meeting, 'attached_product_ids' | 'detected_product_ids'>

  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('speaker, text')
    .eq('meeting_id', id)
    .order('created_at', { ascending: true })
  const transcript = (segments as Pick<TranscriptSegment, 'speaker' | 'text'>[] | null ?? [])
    .map((s) => `${s.speaker ?? 'Speaker'}: ${s.text}`)
    .join('\n')

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
  const catalog = (products ?? []) as Product[]

  const detected = await detectProductsInTranscript(transcript, catalog)

  // Don't blow away ids the user already attached or already dismissed.
  // We compute the new "detected" as the model output minus anything
  // already attached (those are accepted, not pending).
  const attached = new Set(m.attached_product_ids ?? [])
  const filtered = detected.filter((d) => !attached.has(d))

  await supabase
    .from('meetings')
    .update({ detected_product_ids: filtered })
    .eq('id', id)
    .eq('user_id', user.id)

  const byId = new Map(catalog.map((p) => [p.id, p]))
  const products_full = filtered
    .map((d) => byId.get(d))
    .filter((p): p is Product => Boolean(p))

  return NextResponse.json({ detected_product_ids: filtered, products: products_full })
}
