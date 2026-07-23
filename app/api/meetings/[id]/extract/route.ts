import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runMeetingExtraction } from '@/lib/extract-meeting'

export const maxDuration = 60

/**
 * Post-meeting metadata extraction fallback, called fire-and-forget from the
 * processing screen (the PATCH-on-completion and Recall webhook paths normally
 * get there first; `runMeetingExtraction` is idempotent). `?force=1` re-runs.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ownership check with the user client; the extraction itself runs with the
  // service client (same as the webhook path).
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const force = new URL(request.url).searchParams.get('force') === '1'
  await runMeetingExtraction(createServiceClient(), id, { force })

  return NextResponse.json({ ok: true })
}
