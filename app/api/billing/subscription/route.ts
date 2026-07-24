import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/billing/stripe'
import { planById } from '@/lib/billing/plans'
import { NextResponse } from 'next/server'

/**
 * Manage the signed-in user's subscription.
 * Body: { action: 'cancel' | 'resume' } | { action: 'change', planId }.
 *
 * Cancelling sets `cancel_at_period_end` rather than deleting: the user paid
 * for the current period, so they keep the plan (and their credits) until it
 * elapses, and can resume before then. Already-granted credits are never
 * clawed back — cancelling only stops future grants.
 *
 * Changing plan swaps the price with `proration_behavior: 'none'` — nothing is
 * charged or refunded mid-cycle and no credits are granted. The new price and
 * its credit amount both take effect at the next renewal, which arrives as a
 * `subscription_cycle` invoice. Any proration model that granted credits on the
 * change would be farmable: upgrade, keep the credits (they're never clawed
 * back), downgrade for the refund, repeat.
 *
 * The subscription id is read from the user's own row, never from the request
 * body, so a caller can't act on someone else's subscription.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action
  if (action !== 'cancel' && action !== 'resume' && action !== 'change') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const targetPlan = action === 'change' ? planById(String(body?.planId ?? '')) : null
  if (action === 'change') {
    if (!targetPlan) {
      return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 })
    }
    if (!targetPlan.stripePriceId) {
      return NextResponse.json(
        { error: `Stripe price for "${targetPlan.name}" is not configured.` },
        { status: 500 },
      )
    }
  }

  const { data: row } = await supabase
    .from('user_credits')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const subscriptionId = row?.stripe_subscription_id
  if (!subscriptionId) {
    return NextResponse.json({ error: 'No active subscription.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()

    if (action === 'change' && targetPlan) {
      // Swap the price on the existing item — creating a second Checkout
      // session would leave the customer paying for two concurrent
      // subscriptions instead of switching.
      const current = await stripe.subscriptions.retrieve(subscriptionId)
      const item = current.items.data[0]
      if (!item) {
        return NextResponse.json({ error: 'Subscription has no billable item.' }, { status: 500 })
      }
      if (item.price.id === targetPlan.stripePriceId) {
        return NextResponse.json({ error: 'Already on that plan.' }, { status: 400 })
      }

      const sub = await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: item.id, price: targetPlan.stripePriceId }],
        proration_behavior: 'none',
      })
      return NextResponse.json({ planId: targetPlan.id, cancelAtPeriodEnd: sub.cancel_at_period_end })
    }

    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: action === 'cancel',
    })
    // Status bookkeeping is left to the customer.subscription.updated webhook,
    // which is the single writer for user_credits subscription fields.
    return NextResponse.json({ cancelAtPeriodEnd: sub.cancel_at_period_end })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update subscription'
    console.error('[billing/subscription]', action, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
