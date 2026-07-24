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
 */
export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const service = createServiceClient()

  const { data: row } = await service
    .from('user_credits')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (row?.stripe_customer_id) return row.stripe_customer_id

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
