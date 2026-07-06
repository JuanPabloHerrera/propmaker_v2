import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProposalPptx } from '@/lib/pptx'
import { extractPptxTheme } from '@/lib/pptx-theme'
import type { Meeting, PptxTheme, UserProfile } from '@/types'

const DECK_BUCKET = 'reference-decks'

/** Load + parse the chosen style-template deck. Returns null on any problem. */
async function loadTemplateTheme(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  templateId: string,
): Promise<PptxTheme | null> {
  const { data: ref } = await supabase
    .from('reference_proposals')
    .select('file_path, source')
    .eq('id', templateId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!ref || ref.source !== 'pptx_template' || !ref.file_path) return null

  const { data: blob, error } = await supabase.storage.from(DECK_BUCKET).download(ref.file_path)
  if (error || !blob) return null
  return extractPptxTheme(await blob.arrayBuffer())
}

// pptxgenjs reads Node Buffers and relies on fs/https — needs the Node runtime.
export const runtime = 'nodejs'
export const maxDuration = 30 // headroom for the logo fetch

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

  // Optional style template: parse the chosen deck for its theme (colors, fonts,
  // background). Falls back to brand colors when absent or unreadable.
  const template = templateId ? await loadTemplateTheme(supabase, user.id, templateId) : null

  const buf = await buildProposalPptx({
    proposal,
    meeting: (meeting as Meeting | null) ?? null,
    profile: (profile as UserProfile | null) ?? null,
    preparedOn,
    template,
  })

  const filename =
    safeFilename(
      (meeting as Meeting | null)?.client_company ||
        (meeting as Meeting | null)?.title ||
        'proposal',
    ) + '.pptx'

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
