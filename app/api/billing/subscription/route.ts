import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/billing/stripe'
import { NextResponse } from 'next/server'

/**
 * Cancel or resume the signed-in user's subscription.
 * Body: { action: 'cancel' | 'resume' } → { cancelAtPeriodEnd }.
 *
 * Cancelling sets `cancel_at_period_end` rather than deleting: the user paid
 * for the current period, so they keep the plan (and their credits) until it
 * elapses, and can resume before then. Already-granted credits are never
 * clawed back — cancelling only stops future grants.
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
  if (action !== 'cancel' && action !== 'resume') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
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
    const sub = await getStripe().subscriptions.update(subscriptionId, {
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
