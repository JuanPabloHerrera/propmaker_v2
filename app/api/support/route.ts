import { createClient, createServiceClient } from '@/lib/supabase/server'
import { planById } from '@/lib/billing/plans'
import { NextResponse } from 'next/server'

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL ?? 'jp@mappli.co'

const CATEGORIES = ['Bug', 'Billing', 'Feature request', 'Question', 'Other'] as const
type Category = (typeof CATEGORIES)[number]

/** Tickets one account may open per hour before it looks like abuse. */
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Send a support ticket to the team inbox and record it.
 * Body: { category, subject, message, page? }.
 *
 * Account context (email, user id, plan, balance) is read server-side rather
 * than taken from the request, so a ticket always reflects the real account and
 * can't be spoofed.
 *
 * The row is written BEFORE the email is attempted so a provider outage can't
 * lose a report; `email_sent` then records whether delivery worked. Resend is
 * called over plain fetch — one endpoint isn't worth a dependency.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const category = String(body?.category ?? '') as Category
  const subject = String(body?.subject ?? '').trim()
  const message = String(body?.message ?? '').trim()
  const page = String(body?.page ?? '').trim().slice(0, 300)

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Pick a category.' }, { status: 400 })
  }
  if (!subject || !message) {
    return NextResponse.json({ error: 'Subject and message are both required.' }, { status: 400 })
  }
  if (subject.length > 200 || message.length > 5000) {
    return NextResponse.json({ error: 'That message is too long.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Rate limit off the tickets table — in-memory counters are useless on
  // serverless, where consecutive requests may land on different instances.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count: recentCount } = await service
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)

  if ((recentCount ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: `You've sent several messages recently. Please email ${SUPPORT_INBOX} directly.` },
      { status: 429 },
    )
  }

  // The user's own client is enough here — user_credits is SELECT-own under
  // RLS — so this stays on least privilege rather than the service role.
  const { data: credits } = await supabase
    .from('user_credits')
    .select('balance, plan_id, subscription_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = credits?.plan_id ? planById(credits.plan_id) : null
  const planLine = plan
    ? `${plan.name} (${credits?.subscription_status ?? 'unknown'})`
    : 'No subscription'

  // Recorded first: a ticket must survive the email provider being down.
  const { data: ticket, error: insertError } = await service
    .from('support_tickets')
    .insert({
      user_id: user.id,
      email: user.email ?? null,
      category,
      subject,
      message,
      page: page || null,
      plan_id: credits?.plan_id ?? null,
      balance: credits?.balance ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[support] could not record ticket:', insertError.message)
    return NextResponse.json(
      { error: `Could not send your message. Please email ${SUPPORT_INBOX} directly.` },
      { status: 500 },
    )
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[support] RESEND_API_KEY is not set — ticket', ticket.id, 'recorded but not emailed')
    await service
      .from('support_tickets')
      .update({ email_error: 'RESEND_API_KEY not set' })
      .eq('id', ticket.id)
    // The ticket is safely stored, so this is a success for the user.
    return NextResponse.json({ ok: true })
  }

  const context: [string, string][] = [
    ['From', user.email ?? '(no email)'],
    ['User id', user.id],
    ['Plan', planLine],
    ['Credits', String(credits?.balance ?? 0)],
    ['Category', category],
    ['Page', page || '(not given)'],
    ['Ticket', ticket.id],
  ]

  const html = `
    <h2 style="margin:0 0 4px;font:600 16px system-ui">${escapeHtml(subject)}</h2>
    <p style="margin:0 0 16px;color:#666;font:13px system-ui">${escapeHtml(category)} · PropMaker support</p>
    <table style="border-collapse:collapse;font:13px system-ui;margin-bottom:18px">
      ${context
        .map(
          ([k, v]) =>
            `<tr><td style="padding:2px 14px 2px 0;color:#888">${k}</td><td style="padding:2px 0">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}
    </table>
    <div style="white-space:pre-wrap;font:14px/1.55 system-ui;border-top:1px solid #eee;padding-top:14px">${escapeHtml(message)}</div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.SUPPORT_FROM_EMAIL ?? 'PropMaker Support <onboarding@resend.dev>',
        to: [SUPPORT_INBOX],
        // Replying in the inbox goes straight back to the user.
        reply_to: user.email ? [user.email] : undefined,
        subject: `[${category}] ${subject}`,
        html,
      }),
    })

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 500)
      console.error('[support] resend failed', res.status, detail)
      await service
        .from('support_tickets')
        .update({ email_error: `${res.status}: ${detail}` })
        .eq('id', ticket.id)
      // Stored but undelivered — still a success from the user's side.
      return NextResponse.json({ ok: true })
    }

    await service.from('support_tickets').update({ email_sent: true }).eq('id', ticket.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[support]', detail)
    await service
      .from('support_tickets')
      .update({ email_error: detail.slice(0, 500) })
      .eq('id', ticket.id)
    return NextResponse.json({ ok: true })
  }
}
