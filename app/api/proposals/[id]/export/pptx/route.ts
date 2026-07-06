import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProposalPptx } from '@/lib/pptx'
import type { Meeting, UserProfile } from '@/types'

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
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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

  const buf = await buildProposalPptx({
    proposal,
    meeting: (meeting as Meeting | null) ?? null,
    profile: (profile as UserProfile | null) ?? null,
    preparedOn,
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
