import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProposalPptx } from '@/lib/pptx'
import { extractPptxTheme } from '@/lib/pptx-theme'
import { fillProposalIntoTemplate } from '@/lib/pptx-template-fill'
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
export const maxDuration = 60 // template download + parse + re-zip

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

  // Optional style template. When selected, first try to REUSE the template's
  // actual slides (backgrounds/images/layout) with the proposal text swapped in;
  // if that template can't be mapped, fall back to a theme-only deck (colors/
  // fonts/background applied to PropMaker's own layout); with no template, the
  // brand-colored deck.
  const templateBytes = templateId ? await loadTemplateBytes(supabase, user.id, templateId) : null

  let buf: Buffer
  if (templateBytes) {
    const theme = await extractPptxTheme(templateBytes)
    try {
      buf = await fillProposalIntoTemplate({
        templateBytes,
        proposal,
        meeting: m,
        profile: p,
        preparedOn,
        theme,
      })
    } catch (err) {
      console.error('[export/pptx] template-fill failed, falling back to theme-only:', err)
      buf = await buildProposalPptx({ proposal, meeting: m, profile: p, preparedOn, template: theme })
    }
  } else {
    buf = await buildProposalPptx({ proposal, meeting: m, profile: p, preparedOn, template: null })
  }

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
