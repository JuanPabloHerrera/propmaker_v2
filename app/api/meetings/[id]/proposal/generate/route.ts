import { createClient } from '@/lib/supabase/server'
import { gatherMeetingInputs } from '@/lib/meeting-inputs'
import { generateProposal, coerceBrief } from '@/lib/claude'
import { markdownToTiptap } from '@/lib/markdown'
import { NextResponse } from 'next/server'
import type { ProposalBrief } from '@/types'

/**
 * Final proposal generation. Called from the /brief review screen's "Generate
 * proposal" button once the consultant is happy with the prioritized brief.
 *
 * Body: { brief?: ProposalBrief } — the (possibly edited) brief from the review
 * screen. If provided it is persisted first so it wins over any stale copy;
 * otherwise the persisted brief is used. The reviewed brief becomes the
 * highest-authority input to generateProposal, so the proposal is organized
 * around the prioritized, actionable items.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inputs = await gatherMeetingInputs(supabase, id, user.id)
  if (!inputs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))

  // Resolve the brief: prefer the edited one from the request (persist it so it
  // survives), else fall back to whatever is stored on the meeting.
  let brief: ProposalBrief | undefined
  if (body?.brief) {
    brief = coerceBrief(body.brief)
    brief.generatedAt =
      typeof body.brief.generatedAt === 'string' ? body.brief.generatedAt : new Date().toISOString()
    await supabase
      .from('meetings')
      .update({ proposal_brief: brief })
      .eq('id', id)
      .eq('user_id', user.id)
  } else {
    const { data } = await supabase
      .from('meetings')
      .select('proposal_brief')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    brief = (data?.proposal_brief as ProposalBrief | null) ?? undefined
  }

  try {
    const proposalMarkdown = await generateProposal({
      browserTranscript: inputs.browserTranscript,
      recallTranscript: inputs.recallTranscript,
      notesText: inputs.notesText,
      products: inputs.products,
      chatHistory: inputs.chatHistory,
      liveChatHistory: inputs.liveChatHistory,
      meetingType: inputs.meetingType,
      referenceProposals: inputs.referenceProposals,
      brief,
    })
    const content_json = markdownToTiptap(proposalMarkdown)

    // Upsert: one proposal per meeting.
    const { data: existing } = await supabase
      .from('proposals')
      .select('id')
      .eq('meeting_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) {
      await supabase.from('proposals').update({ content_json }).eq('id', existing.id)
    } else {
      await supabase.from('proposals').insert({
        meeting_id: id,
        user_id: user.id,
        content_json,
        status: 'draft',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate proposal'
    console.error('[proposal/generate]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
