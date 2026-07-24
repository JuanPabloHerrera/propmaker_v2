import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

let stripeSingleton: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    stripeSingleton = new Stripe(key)
  }
  return stripeSingleton
}

/**
 * Find or create the Stripe customer for a user, persisting the id on
 * user_credits. The customer carries metadata.user_id so webhooks can always
 * resolve the PropMaker user even without our DB row.
 *
 * A stored id is verified before it's trusted. Stripe's test and live modes are
 * separate namespaces, so a test-mode id is meaningless once live keys are in
 * play — and returning it unchecked would fail checkout with "No such customer"
 * forever, since nothing would ever replace it. The same recovery covers a
 * customer deleted by hand in the dashboard.
 */
export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const service = createServiceClient()

  const { data: row } = await service
    .from('user_credits')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (row?.stripe_customer_id) {
    const existing = await getStripe()
      .customers.retrieve(row.stripe_customer_id)
      .catch(() => null)
    if (existing && !existing.deleted) return existing.id
    console.warn(
      '[billing/stripe] stored customer',
      row.stripe_customer_id,
      'is gone (wrong mode or deleted) — creating a new one for',
      userId,
    )
  }

  const customer = await getStripe().customers.create({
    email,
    metadata: { user_id: userId },
  })

  // Row exists for every user (signup trigger / backfill), but upsert to be safe.
  await service
    .from('user_credits')
    .upsert(
      { user_id: userId, stripe_customer_id: customer.id },
      { onConflict: 'user_id' },
    )

  return customer.id
}
