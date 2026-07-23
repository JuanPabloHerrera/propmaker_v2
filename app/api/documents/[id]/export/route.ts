import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProposalPptx } from '@/lib/pptx'
import { extractPptxTheme } from '@/lib/pptx-theme'
import { runDocumentExport, type ExportFormat } from '@/lib/document-export'
import type { Meeting, UserProfile } from '@/types'

const DECK_BUCKET = 'reference-decks'
const FORMATS: ExportFormat[] = ['pptx', 'docx', 'pdf']

/** Download the chosen style-template deck's bytes. Returns null on any problem. */
async function loadTemplateBytes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  templateId: string,
): Promise<ArrayBuffer | null> {
  const { data: ref } = await supabase
    .from('reference_proposals')
    .select('file_path, source')
    .eq('id', templateId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!ref || ref.source !== 'pptx_template' || !ref.file_path) return null

  const { data: blob, error } = await supabase.storage.from(DECK_BUCKET).download(ref.file_path)
  if (error || !blob) return null
  return blob.arrayBuffer()
}

// pptxgenjs/jszip read Node Buffers — needs the Node runtime.
export const runtime = 'nodejs'
// GET (instant fast deck) finishes well under a minute. POST kicks off the
// Claude-skill build in after(), which needs a long window — 300s (Vercel Pro /
// Fluid Compute ceiling). If a build routinely exceeds it, move the worker to a
// durable queue.
export const maxDuration = 300

function safeFilename(input: string): string {
  const base = (input || 'document')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'document'
}

async function loadOwnedDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  userId: string,
) {
  const { data: document } = await supabase
    .from('meeting_documents')
    .select('id, user_id, meeting_id, doc_type, title, language, content_json')
    .eq('id', id)
    .single()
  if (!document) return { document: null, response: NextResponse.json({ error: 'Document not found' }, { status: 404 }) }
  if (document.user_id !== userId) {
    return { document: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (!document.content_json?.content?.length) {
    return {
      document: null,
      response: NextResponse.json(
        { error: 'This document has no content to export yet.' },
        { status: 422 },
      ),
    }
  }
  return { document, response: null }
}

/** GET — instant pptxgenjs deck (pptx only), kept as the quick download path. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const templateId = new URL(req.url).searchParams.get('template')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { document, response } = await loadOwnedDocument(supabase, id, user.id)
  if (!document) return response!

  const [{ data: meeting }, { data: profile }] = await Promise.all([
    supabase.from('meetings').select('*').eq('id', document.meeting_id).single(),
    supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const preparedOn = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const m = (meeting as Meeting | null) ?? null
  const p = (profile as UserProfile | null) ?? null

  // Optional style template: extract its BRAND (colors, fonts, background) and
  // build a fresh clean deck in that brand; with no template, use brand colors.
  const templateBytes = templateId ? await loadTemplateBytes(supabase, user.id, templateId) : null
  const theme = templateBytes ? await extractPptxTheme(templateBytes) : null
  const buf = await buildProposalPptx({ proposal: document, meeting: m, profile: p, preparedOn, template: theme })

  const filename =
    safeFilename(document.title || m?.client_company || m?.title || 'document') + '.pptx'

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  })
}

// -------------------------------------------------------------------------
// POST — start the high-fidelity Claude-skill build for any format
// (?format=pptx|docx|pdf, default pptx; ?template=<refId> for pptx Mode A).
// Takes minutes, so this returns a job id immediately and the build runs in
// after(); the client polls `/export/download?job=<id>` (202 until ready) —
// the deck_exports row is also Realtime-enabled for future push UIs.
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

  const { document, response } = await loadOwnedDocument(supabase, id, user.id)
  if (!document) return response!

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
