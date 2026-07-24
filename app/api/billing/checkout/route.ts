import { createClient } from '@/lib/supabase/server'
import { getStripe, getOrCreateStripeCustomer } from '@/lib/billing/stripe'
import { planById, packById } from '@/lib/billing/plans'
import { NextResponse } from 'next/server'

/**
 * Start a Stripe Checkout session.
 * Body: { kind: 'plan' | 'pack', id: string } → { url }.
 * Plans are recurring subscriptions; packs are one-time payments.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const kind = body?.kind as 'plan' | 'pack'
  const itemId = String(body?.id ?? '')

  const plan = kind === 'plan' ? planById(itemId) : null
  const pack = kind === 'pack' ? packById(itemId) : null
  const item = plan ?? pack
  if (!item) {
    return NextResponse.json({ error: 'Unknown plan or pack.' }, { status: 400 })
  }
  if (!item.stripePriceId) {
    return NextResponse.json(
      { error: `Stripe price for "${item.name}" is not configured.` },
      { status: 500 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not set.' }, { status: 500 })
  }

  try {
    const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? '')
    const credits = plan ? plan.monthlyCredits : pack!.credits

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: plan ? 'subscription' : 'payment',
      line_items: [{ price: item.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/billing?status=success`,
      cancel_url: `${appUrl}/billing?status=cancelled`,
      metadata: { user_id: user.id, kind, item_id: item.id, credits: String(credits) },
      ...(plan
        ? { subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } } }
        : {}),
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    console.error('[billing/checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
