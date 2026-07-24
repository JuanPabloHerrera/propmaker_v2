import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/billing/stripe'
import { planByPriceId } from '@/lib/billing/plans'
import { NextResponse } from 'next/server'

/**
 * Stripe webhook. Grants credits and tracks subscription state.
 *
 * Grant rules (idempotent via credit_transactions.stripe_event_id):
 *  - checkout.session.completed, mode=payment  → one-time pack purchase
 *  - invoice.paid                              → subscription grant (first
 *    invoice AND every renewal — never grant subscriptions on checkout
 *    completion, or the first month would double-grant)
 *  - customer.subscription.updated/deleted     → status bookkeeping only
 *    (already-granted credits are never clawed back)
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/stripe] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Signature is computed over the raw body — read text BEFORE any JSON parse.
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('[webhooks/stripe] signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        // Packs only — subscription credits are granted via invoice.paid.
        if (session.mode !== 'payment') break

        const userId = session.metadata?.user_id
        const credits = Number(session.metadata?.credits ?? 0)
        if (!userId || !Number.isFinite(credits) || credits <= 0) {
          console.error('[webhooks/stripe] checkout.session.completed missing metadata', session.id)
          break
        }

        const { error } = await service.rpc('grant_credits', {
          p_user_id: userId,
          p_amount: credits,
          p_type: 'purchase',
          p_reason: `pack:${session.metadata?.item_id ?? 'unknown'}`,
          p_stripe_event_id: event.id,
          p_metadata: { checkout_session_id: session.id },
        })
        if (error) throw new Error(`grant_credits (pack) failed: ${error.message}`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break

        // Resolve the user: our DB row first, then customer metadata.
        let userId: string | null = null
        const { data: row } = await service
          .from('user_credits')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        userId = row?.user_id ?? null
        if (!userId) {
          const customer = await getStripe().customers.retrieve(customerId)
          if (!customer.deleted) userId = customer.metadata?.user_id ?? null
        }
        if (!userId) {
          console.error('[webhooks/stripe] invoice.paid: could not resolve user for', customerId)
          break
        }

        // Resolve the plan from the invoice line's price id.
        const lines = invoice.lines?.data ?? []
        const priceId = lines
          .map((l) => l.pricing?.price_details?.price)
          .find((p): p is string => typeof p === 'string')
        const plan = planByPriceId(priceId)
        if (!plan) {
          // Not one of our plan prices (e.g. a $0 trial line) — ignore.
          console.warn('[webhooks/stripe] invoice.paid without a known plan price', invoice.id)
          break
        }

        const { error: grantError } = await service.rpc('grant_credits', {
          p_user_id: userId,
          p_amount: plan.monthlyCredits,
          p_type: 'subscription_grant',
          p_reason: `plan:${plan.id}`,
          p_stripe_event_id: event.id,
          p_metadata: { invoice_id: invoice.id },
        })
        if (grantError) throw new Error(`grant_credits (plan) failed: ${grantError.message}`)

        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === 'string'
            ? invoice.parent.subscription_details.subscription
            : (invoice.parent?.subscription_details?.subscription?.id ?? null)

        await service
          .from('user_credits')
          .update({
            plan_id: plan.id,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
          })
          .eq('user_id', userId)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const status =
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : subscription.status === 'active' || subscription.status === 'trialing'
              ? 'active'
              : subscription.status

        await service
          .from('user_credits')
          .update({
            subscription_status: status,
            ...(event.type === 'customer.subscription.deleted'
              ? { plan_id: null, stripe_subscription_id: null }
              : {}),
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed'
    console.error('[webhooks/stripe]', event.type, message)
    // Non-2xx → Stripe retries; grants are idempotent so retries are safe.
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
