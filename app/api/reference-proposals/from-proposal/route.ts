import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { summarizeReferenceText } from '@/lib/claude'
import { extractInAppProposalText } from '@/lib/reference-extract'
import type { TiptapDocument } from '@/types'

export const runtime = 'nodejs'

// Reuse a proposal already generated in the app as a reference.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const proposalId: string | undefined = body?.proposal_id
  const title = (body?.title as string | undefined)?.trim()
  if (!proposalId || !title) {
    return NextResponse.json({ error: 'proposal_id and title are required' }, { status: 400 })
  }

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, content_json')
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  const text = extractInAppProposalText(proposal.content_json as TiptapDocument | null)
  if (!text.trim()) {
    return NextResponse.json({ error: 'That proposal has no content to summarize yet.' }, { status: 422 })
  }

  let summary: string
  try {
    summary = await summarizeReferenceText(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Summarization failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
  if (!summary.trim()) {
    return NextResponse.json({ error: 'Could not summarize that proposal.' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('reference_proposals')
    .insert({
      user_id: user.id,
      title,
      summary,
      source: 'app_proposal',
      source_proposal_id: proposalId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
