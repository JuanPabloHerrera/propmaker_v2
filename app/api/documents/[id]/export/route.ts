import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runDocumentExport, type ExportFormat } from '@/lib/document-export'

const FORMATS: ExportFormat[] = ['pptx', 'docx', 'pdf']

export const runtime = 'nodejs'
// The Claude-skill build runs in after() and needs a long window — 300s
// (Vercel Pro / Fluid Compute ceiling). If a build routinely exceeds it, move
// the worker to a durable queue.
export const maxDuration = 300

function safeFilename(input: string): string {
  const base = (input || 'document')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'document'
}

// -------------------------------------------------------------------------
// POST — start the Claude-skill build for any format
// (?format=pptx|docx|pdf, default pptx; ?template=<refId> for pptx Mode A).
// Takes minutes, so this returns a job id immediately and the build runs in
// after(); the client polls `/export/download?job=<id>` (202 until ready) —
// the deck_exports row is also Realtime-enabled for future push UIs.
// There is NO fallback engine: a failed build marks the job failed and the
// client tells the user to try again.
// -------------------------------------------------------------------------
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const url = new URL(req.url)
  const templateId = url.searchParams.get('template')
  const format = (url.searchParams.get('format') ?? 'pptx') as ExportFormat
  if (!FORMATS.includes(format)) {
    return NextResponse.json({ error: 'format must be pptx, docx, or pdf' }, { status: 400 })
  }
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: document } = await supabase
    .from('meeting_documents')
    .select('id, user_id, meeting_id, doc_type, title, language, content_json')
    .eq('id', id)
    .single()
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (document.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!document.content_json?.content?.length) {
    return NextResponse.json(
      { error: 'This document has no content to export yet.' },
      { status: 422 },
    )
  }

  // A template is OPTIONAL and pptx-only. With one, Claude reproduces it on
  // every slide (Mode A); without one it designs from the user's brand (Mode B).
  if (templateId && format === 'pptx') {
    const { data: ref } = await supabase
      .from('reference_proposals')
      .select('id, source')
      .eq('id', templateId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!ref || ref.source !== 'pptx_template') {
      return NextResponse.json({ error: 'Template not found' }, { status: 400 })
    }
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('client_company, title')
    .eq('id', document.meeting_id)
    .maybeSingle()
  const filename =
    safeFilename(document.title || meeting?.client_company || meeting?.title || 'document') +
    `.${format}`

  const { data: job, error: insErr } = await supabase
    .from('deck_exports')
    .insert({
      document_id: id,
      user_id: user.id,
      template_ref_id: format === 'pptx' ? templateId || null : null,
      status: 'queued',
      engine: 'skill',
      format,
      filename,
    })
    .select('id')
    .single()
  if (insErr || !job) {
    return NextResponse.json({ error: 'Could not start the export.' }, { status: 500 })
  }

  // Run the build after the response is sent (bounded by maxDuration).
  after(() => runDocumentExport(job.id))

  return NextResponse.json({ jobId: job.id, status: 'queued' })
}
