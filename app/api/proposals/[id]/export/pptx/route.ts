import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProposalPptx } from '@/lib/pptx'
import { extractPptxTheme } from '@/lib/pptx-theme'
import { runDeckBuild } from '@/lib/pptx-skill'
import type { Meeting, UserProfile } from '@/types'

const DECK_BUCKET = 'reference-decks'

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
// durable queue (see the plan's caveats).
export const maxDuration = 300

function safeFilename(input: string): string {
  const base = (input || 'proposal')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'proposal'
}

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

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('id, user_id, meeting_id, content_json')
    .eq('id', id)
    .single()
  if (error || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }
  if (proposal.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!proposal.content_json?.content?.length) {
    return NextResponse.json(
      { error: 'This proposal has no content to export yet.' },
      { status: 422 },
    )
  }

  const [{ data: meeting }, { data: profile }] = await Promise.all([
    supabase.from('meetings').select('*').eq('id', proposal.meeting_id).single(),
    supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const preparedOn = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const m = (meeting as Meeting | null) ?? null
  const p = (profile as UserProfile | null) ?? null

  // Optional style template. When one is selected we extract its BRAND (colors,
  // fonts, and background — contrast-aware) and build a fresh, clean deck with the
  // proposal's content in that brand. We deliberately do NOT reuse the template's
  // own slides: that left the template's sample text behind and overlapped it with
  // the proposal text. With no template, the user's brand colors are used.
  const templateBytes = templateId ? await loadTemplateBytes(supabase, user.id, templateId) : null
  const theme = templateBytes ? await extractPptxTheme(templateBytes) : null
  const buf = await buildProposalPptx({ proposal, meeting: m, profile: p, preparedOn, template: theme })

  const filename = safeFilename(m?.client_company || m?.title || 'proposal') + '.pptx'

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
// POST — start the high-fidelity, template-reproducing build. Claude runs the
// `pptx` skill (+ our custom skill) in a code-execution container to reproduce
// the selected brand template on every slide (see lib/pptx-skill.ts). That
// takes minutes, so this returns a job id immediately and the build runs in
// after(); the client polls `/export/pptx/download?job=<id>` (which 202s until
// ready) — the deck_exports row is also Realtime-enabled for future push UIs.
// -------------------------------------------------------------------------
export async function POST(
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

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('id, user_id, meeting_id, content_json')
    .eq('id', id)
    .single()
  if (error || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }
  if (proposal.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!proposal.content_json?.content?.length) {
    return NextResponse.json(
      { error: 'This proposal has no content to export yet.' },
      { status: 422 },
    )
  }
  if (!templateId) {
    return NextResponse.json(
      { error: 'A brand template is required for the branded build.' },
      { status: 400 },
    )
  }

  // Validate template ownership before spending on a build.
  const { data: ref } = await supabase
    .from('reference_proposals')
    .select('id, source')
    .eq('id', templateId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!ref || ref.source !== 'pptx_template') {
    return NextResponse.json({ error: 'Template not found' }, { status: 400 })
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('client_company, title')
    .eq('id', proposal.meeting_id)
    .maybeSingle()
  const filename =
    safeFilename(meeting?.client_company || meeting?.title || 'proposal') + '.pptx'

  const { data: job, error: insErr } = await supabase
    .from('deck_exports')
    .insert({
      proposal_id: id,
      user_id: user.id,
      template_ref_id: templateId,
      status: 'queued',
      engine: 'skill',
      filename,
    })
    .select('id')
    .single()
  if (insErr || !job) {
    return NextResponse.json({ error: 'Could not start the export.' }, { status: 500 })
  }

  // Run the build after the response is sent (bounded by maxDuration).
  after(() => runDeckBuild(job.id))

  return NextResponse.json({ jobId: job.id, status: 'queued' })
}
