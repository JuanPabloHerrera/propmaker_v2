import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DOCUMENT_CREDIT_COST } from '@/lib/billing/plans'
import { getSubscriptionDetails } from '@/lib/billing/subscription'
import { CreditBalanceCard } from '@/components/billing/CreditBalanceCard'
import { PricingSection } from '@/components/billing/PricingSection'
import { SubscriptionCard } from '@/components/billing/SubscriptionCard'
import { TransactionList } from '@/components/billing/TransactionList'
import type { CreditTransaction } from '@/types'

export default async function BillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const [creditsRes, txRes] = await Promise.all([
    supabase
      .from('user_credits')
      .select('balance, plan_id, subscription_status, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('credit_transactions')
      .select('id, user_id, type, amount, balance_after, reason, reference_id, stripe_event_id, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const balance = creditsRes.data?.balance ?? 0
  const planId = creditsRes.data?.plan_id ?? null
  const subscriptionStatus = creditsRes.data?.subscription_status ?? null
  const transactions = (txRes.data ?? []) as CreditTransaction[]

  // Read live from Stripe rather than mirroring the renewal date into our DB,
  // where it would go stale between webhooks.
  const subscription = await getSubscriptionDetails(creditsRes.data?.stripe_subscription_id)
  const renewsAt = subscription?.renewsAt?.toISOString() ?? null
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false

  return (
    <div className="pm-page lg-shell" style={{ padding: '28px 36px 40px' }}>
      <div className="pm-eyebrow">Billing</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        Credits &amp; plans
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 22 }}>
        Each generated document costs {DOCUMENT_CREDIT_COST} credits. Subscription credits roll
        over while your plan is active.
      </p>

      <div className="flex flex-col gap-5" style={{ maxWidth: 960 }}>
        <CreditBalanceCard
          balance={balance}
          planId={planId}
          subscriptionStatus={subscriptionStatus}
          renewsAt={renewsAt}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
        />
        <PricingSection
          currentPlanId={planId}
          canSwitchPlan={Boolean(subscription && !cancelAtPeriodEnd)}
        />
        <TransactionList transactions={transactions} />
        {planId && subscription ? (
          <SubscriptionCard
            planId={planId}
            balance={balance}
            renewsAt={renewsAt}
            cancelAtPeriodEnd={cancelAtPeriodEnd}
          />
        ) : null}
      </div>
    </div>
  )
}
