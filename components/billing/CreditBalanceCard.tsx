import { format } from 'date-fns'
import { Icon } from '@/components/ui/icon'
import { DOCUMENT_CREDIT_COST, planById } from '@/lib/billing/plans'

interface CreditBalanceCardProps {
  balance: number
  planId: string | null
  subscriptionStatus: string | null
  /** ISO date the current period ends — next billing date, or access-until when cancelling. */
  renewsAt?: string | null
  cancelAtPeriodEnd?: boolean
}

export function CreditBalanceCard({
  balance,
  planId,
  subscriptionStatus,
  renewsAt = null,
  cancelAtPeriodEnd = false,
}: CreditBalanceCardProps) {
  const plan = planId ? planById(planId) : null
  const periodEnd = renewsAt ? format(new Date(renewsAt), 'MMM d, yyyy') : null
  const docsLeft = Math.floor(balance / DOCUMENT_CREDIT_COST)
  const low = balance < DOCUMENT_CREDIT_COST

  return (
    <div className="card flex items-center gap-5" style={{ borderRadius: 14, padding: '20px 24px' }}>
      <div
        aria-hidden="true"
        className="grid place-items-center shrink-0"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: low ? 'rgba(217, 119, 6, 0.1)' : 'rgba(77, 138, 107, 0.12)',
          color: low ? '#b45309' : 'var(--accent-base)',
        }}
      >
        <Icon name="sparkle" size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="mono-num text-[26px] font-semibold" style={{ color: 'var(--ink-1)' }}>
            {balance.toLocaleString()}
          </span>
          <span className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
            credits
          </span>
        </div>
        <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          {low
            ? `Not enough for a document (${DOCUMENT_CREDIT_COST} needed) — top up below.`
            : `Enough for ${docsLeft} more ${docsLeft === 1 ? 'document' : 'documents'}.`}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-[12.5px] font-medium" style={{ color: 'var(--ink-1)' }}>
          {plan ? `${plan.name} plan` : 'Free'}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {plan
            ? subscriptionStatus === 'active'
              ? `${plan.monthlyCredits.toLocaleString()} credits / month`
              : (subscriptionStatus ?? 'inactive')
            : 'No subscription'}
        </div>
        {plan && periodEnd ? (
          <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {cancelAtPeriodEnd ? `Ends ${periodEnd}` : `Renews ${periodEnd}`}
          </div>
        ) : null}
      </div>
    </div>
  )
}
