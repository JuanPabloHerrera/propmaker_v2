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

/** Mint a public slug + record recipients for any document type. */
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

  // Get document — verify ownership + check for an existing slug.
  const { data: document, error: documentErr } = await supabase
    .from('meeting_documents')
    .select('id, user_id, public_slug, meeting_id, doc_type')
    .eq('id', id)
    .single()
  if (documentErr || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  if (document.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Mint a slug if there isn't one yet. On a proposal's first share, bump the
  // meeting's deal_status to "proposal_sent" — unless the user has already
  // moved it to a terminal state (won/lost).
  let slug = document.public_slug as string | null
  const isFirstShare = !slug
  if (!slug) {
    const { data: meeting } = await supabase
      .from('meetings')
      .select('title, client_company')
      .eq('id', document.meeting_id)
      .single()
    const base = slugify(
      meeting?.client_company || meeting?.title || `${document.doc_type}-${id.slice(0, 8)}`,
    ) || `${document.doc_type}-${id.slice(0, 8)}`
    slug = `${base}-${randomSuffix()}`

    const { error: updateErr } = await supabase
      .from('meeting_documents')
      .update({ public_slug: slug, shared_at: new Date().toISOString() })
      .eq('id', id)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  if (isFirstShare && document.doc_type === 'proposal') {
    // .not is permissive — only bump from draft/upcoming/proposal_sent into
    // proposal_sent. won/lost stay put because the user declared the outcome.
    await supabase
      .from('meetings')
      .update({ deal_status: 'proposal_sent' })
      .eq('id', document.meeting_id)
      .eq('user_id', user.id)
      .not('deal_status', 'in', '(won,lost)')
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
