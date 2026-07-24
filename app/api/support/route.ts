import { createClient, createServiceClient } from '@/lib/supabase/server'
import { planById } from '@/lib/billing/plans'
import { NextResponse } from 'next/server'

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL ?? 'jp@mappli.co'

const CATEGORIES = ['Bug', 'Billing', 'Feature request', 'Question', 'Other'] as const
type Category = (typeof CATEGORIES)[number]

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Send a support ticket to the team inbox.
 * Body: { category, subject, message, page? }.
 *
 * Account context (email, user id, plan, balance) is read server-side rather
 * than taken from the request, so a ticket always reflects the real account and
 * can't be spoofed. Resend is called over plain fetch — one endpoint isn't
 * worth a dependency.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const category = String(body?.category ?? '') as Category
  const subject = String(body?.subject ?? '').trim()
  const message = String(body?.message ?? '').trim()
  const page = String(body?.page ?? '').trim()

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Pick a category.' }, { status: 400 })
  }
  if (!subject || !message) {
    return NextResponse.json({ error: 'Subject and message are both required.' }, { status: 400 })
  }
  if (subject.length > 200 || message.length > 5000) {
    return NextResponse.json({ error: 'That message is too long.' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[support] RESEND_API_KEY is not set')
    return NextResponse.json(
      { error: `Support email isn't configured. Please email ${SUPPORT_INBOX} directly.` },
      { status: 500 },
    )
  }

  // Account context, read server-side — never trusted from the client.
  const service = createServiceClient()
  const { data: credits } = await service
    .from('user_credits')
    .select('balance, plan_id, subscription_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = credits?.plan_id ? planById(credits.plan_id) : null
  const planLine = plan
    ? `${plan.name} (${credits?.subscription_status ?? 'unknown'})`
    : 'No subscription'

  const context: [string, string][] = [
    ['From', user.email ?? '(no email)'],
    ['User id', user.id],
    ['Plan', planLine],
    ['Credits', String(credits?.balance ?? 0)],
    ['Category', category],
    ['Page', page || '(not given)'],
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
      const detail = await res.text().catch(() => '')
      console.error('[support] resend failed', res.status, detail)
      return NextResponse.json(
        { error: `Could not send your message. Please email ${SUPPORT_INBOX} directly.` },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[support]', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: `Could not send your message. Please email ${SUPPORT_INBOX} directly.` },
      { status: 502 },
    )
  }
}
