import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Records a public proposal view. Uses the service-role client
 * because the request is anonymous (no auth cookie on /p/[slug]).
 *
 * - Bumps proposals.open_count on every call.
 * - Sets proposals.first_opened_at only on the very first view.
 *
 * Safe to call repeatedly; the count tracks total opens (including
 * the owner re-checking their own link).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const svc = createServiceClient()

  const { data: proposal } = await svc
    .from('meeting_documents')
    .select('id, first_opened_at, open_count')
    .eq('public_slug', slug)
    .maybeSingle()

  if (!proposal) {
    // Don't 404 publicly — return 204 so we don't leak slug existence
    // through error codes.
    return new NextResponse(null, { status: 204 })
  }

  const update: Record<string, unknown> = {
    open_count: (proposal.open_count ?? 0) + 1,
  }
  if (!proposal.first_opened_at) {
    update.first_opened_at = new Date().toISOString()
  }

  await svc.from('meeting_documents').update(update).eq('id', proposal.id)
  return new NextResponse(null, { status: 204 })
}
