import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Serves a finished branded deck built by the async job (see ../route.ts POST +
// lib/pptx-skill.ts). While the job is still running it returns 202 with the
// current status — so the client can also poll this as a fallback to Realtime.
export const runtime = 'nodejs'
export const maxDuration = 60

const OUTPUT_BUCKET = 'generated-decks'
const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const jobId = new URL(req.url).searchParams.get('job')
  if (!jobId) return NextResponse.json({ error: 'Missing job id' }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS restricts to the owner's rows.
  const { data: job } = await supabase
    .from('deck_exports')
    .select('id, proposal_id, status, error, file_path, filename')
    .eq('id', jobId)
    .maybeSingle()
  if (!job || job.proposal_id !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (job.status === 'failed') {
    return NextResponse.json(
      { status: 'failed', error: job.error ?? 'Export failed' },
      { status: 200 },
    )
  }
  if (job.status !== 'succeeded' || !job.file_path) {
    // Still working — 202 lets the client keep polling.
    return NextResponse.json({ status: job.status }, { status: 202 })
  }

  const { data: blob, error } = await supabase.storage
    .from(OUTPUT_BUCKET)
    .download(job.file_path)
  if (error || !blob) {
    return NextResponse.json({ error: 'Deck file missing' }, { status: 404 })
  }
  const buf = Buffer.from(await blob.arrayBuffer())
  const filename = job.filename || 'proposal.pptx'

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': PPTX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  })
}
