import { createClient } from '@/lib/supabase/server'
import { gatherMeetingInputs } from '@/lib/meeting-inputs'
import { generateMeetingBrief } from '@/lib/claude'
import { NextResponse } from 'next/server'
import type { ProposalBrief } from '@/types'

// GET → the persisted brief for this meeting (or null if not generated yet).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('meetings')
    .select('proposal_brief')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ brief: (data.proposal_brief as ProposalBrief | null) ?? null })
}

// POST → synthesize a fresh brief from every meeting input and persist it.
// Used on first load of the /brief screen and by the "Regenerate" button.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inputs = await gatherMeetingInputs(supabase, id, user.id)
  if (!inputs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const brief = await generateMeetingBrief(inputs)
    brief.generatedAt = new Date().toISOString()

    const { error } = await supabase
      .from('meetings')
      .update({ proposal_brief: brief })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ brief })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate brief'
    console.error('[meetings/brief]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
