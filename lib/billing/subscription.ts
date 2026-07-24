import { getStripe } from './stripe'

export interface SubscriptionDetails {
  status: string
  /** When the current paid period ends — the next billing date, or the access-until date when cancelling. */
  renewsAt: Date | null
  /** True once the user has cancelled but the paid period hasn't elapsed yet. */
  cancelAtPeriodEnd: boolean
}

/**
 * Read the live subscription state from Stripe.
 *
 * Deliberately not mirrored into `user_credits`: the renewal date changes on
 * Stripe's schedule, not ours, so a stored copy goes stale between webhooks.
 *
 * NOTE: `subscription.current_period_end` is `undefined` on current API
 * versions — the period moved onto the subscription ITEM. Reading it from the
 * item (with the legacy top-level field as a fallback) is the whole reason this
 * helper exists; do the lookup here, never inline at call sites.
 */
export async function getSubscriptionDetails(
  subscriptionId: string | null | undefined,
): Promise<SubscriptionDetails | null> {
  if (!subscriptionId) return null

  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId)
    const periodEnd =
      sub.items?.data?.[0]?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      null

    return {
      status: sub.status,
      renewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    }
  } catch (err) {
    // A deleted/unknown subscription shouldn't take the billing page down.
    console.error('[billing/subscription] could not load', subscriptionId, err)
    return null
  }
}
