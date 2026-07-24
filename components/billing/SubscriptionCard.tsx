'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { planById } from '@/lib/billing/plans'
import { formatNumber } from '@/lib/format'

interface SubscriptionCardProps {
  planId: string
  balance: number
  renewsAt: string | null
  cancelAtPeriodEnd: boolean
}

export function SubscriptionCard({
  planId,
  balance,
  renewsAt,
  cancelAtPeriodEnd,
}: SubscriptionCardProps) {
  const router = useRouter()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const plan = planById(planId)
  const endsOn = renewsAt ? format(new Date(renewsAt), 'MMMM d, yyyy') : null

  async function update(action: 'cancel' | 'resume') {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not update subscription')

      setConfirming(false)
      toast.success(
        action === 'cancel'
          ? endsOn
            ? `Plan cancelled — you keep it until ${endsOn}.`
            : 'Plan cancelled at the end of the period.'
          : 'Plan resumed.',
      )
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update subscription')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        className="card flex items-center gap-4"
        style={{ borderRadius: 14, padding: '16px 20px' }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium" style={{ color: 'var(--ink-1)' }}>
            {plan ? `${plan.name} plan` : 'Subscription'}
          </div>
          {/* `endsOn` is formatted in the runtime's timezone, so the UTC server and
              a UTC-6 browser disagree across a midnight boundary. The client value
              is the one we want, so skip the hydration check on this node only. */}
          <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }} suppressHydrationWarning>
            {cancelAtPeriodEnd
              ? endsOn
                ? `Cancels on ${endsOn}. You keep your credits and can resume before then.`
                : 'Cancels at the end of the current period.'
              : endsOn
                ? `Renews ${endsOn}. Cancelling keeps your plan until then.`
                : 'Cancelling keeps your plan until the period ends.'}
          </div>
        </div>

        {cancelAtPeriodEnd ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => update('resume')}
            className="shrink-0 rounded-[8px] text-[12px] font-medium"
            style={{
              padding: '8px 14px',
              background: 'var(--accent-base)',
              color: '#fff',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Resuming…' : 'Resume plan'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-[8px] text-[12px] font-medium"
            style={{
              padding: '8px 14px',
              background: 'rgba(28,24,20,0.06)',
              color: 'var(--ink-2)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel plan
          </button>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !open && !busy && setConfirming(false)}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col gap-2 pt-1">
            <DialogTitle className="text-[15px] font-semibold" style={{ color: 'var(--ink-1)' }}>
              Cancel {plan ? `${plan.name} plan` : 'plan'}?
            </DialogTitle>
            <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              You keep your{' '}
              <span className="mono-num font-medium">{formatNumber(balance)}</span> credits
              {endsOn ? ` and stay on the plan until ${endsOn}` : ' until the period ends'}. After
              that you won&apos;t be billed again and no new monthly credits are added. You can
              resume any time before then.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-[8px] text-[12px] font-medium"
                style={{
                  padding: '8px 0',
                  background: 'rgba(28,24,20,0.06)',
                  color: 'var(--ink-2)',
                }}
              >
                Keep plan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => update('cancel')}
                className="flex-1 rounded-[8px] text-[12px] font-medium"
                style={{
                  padding: '8px 0',
                  background: '#b45309',
                  color: '#fff',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Cancelling…' : 'Cancel plan'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
