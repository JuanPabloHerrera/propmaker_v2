import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function randomSuffix(): string {
  // Short, URL-safe, low-collision suffix.
  return Math.random().toString(36).slice(2, 8)
}

interface Recipient {
  email: string
  name?: string
}

interface SharePayload {
  recipients?: Recipient[]
  message?: string
  slugHint?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as SharePayload
  const recipients = body.recipients ?? []
  const message = body.message ?? null

  // Get proposal — verify ownership + check for an existing slug.
  const { data: proposal, error: proposalErr } = await supabase
    .from('proposals')
    .select('id, user_id, public_slug, meeting_id')
    .eq('id', id)
    .single()
  if (proposalErr || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }
  if (proposal.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Mint a slug if there isn't one yet.
  let slug = proposal.public_slug as string | null
  if (!slug) {
    const { data: meeting } = await supabase
      .from('meetings')
      .select('title, client_company')
      .eq('id', proposal.meeting_id)
      .single()
    const base = slugify(
      meeting?.client_company || meeting?.title || `proposal-${id.slice(0, 8)}`,
    ) || `proposal-${id.slice(0, 8)}`
    slug = `${base}-${randomSuffix()}`

    const { error: updateErr } = await supabase
      .from('proposals')
      .update({ public_slug: slug, shared_at: new Date().toISOString() })
      .eq('id', id)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  // Record recipient rows (no email sent — preview mode).
  if (recipients.length > 0) {
    const rows = recipients
      .filter((r) => r.email?.trim())
      .map((r) => ({
        proposal_id: id,
        recipient_email: r.email.trim(),
        message_body: message,
      }))
    if (rows.length > 0) {
      const { error: sharesErr } = await supabase.from('proposal_shares').insert(rows)
      if (sharesErr) {
        return NextResponse.json({ error: sharesErr.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ slug, sent: recipients.length })
}
