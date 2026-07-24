'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DOCUMENT_CREDIT_COST, PACKS, PLANS, planById } from '@/lib/billing/plans'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PricingSectionProps {
  currentPlanId: string | null
  /**
   * True when the user has a live subscription, so picking another tier must
   * SWITCH the existing one. Starting a second Checkout would leave them
   * paying for two concurrent subscriptions.
   */
  canSwitchPlan?: boolean
}

export function PricingSection({ currentPlanId, canSwitchPlan = false }: PricingSectionProps) {
  const router = useRouter()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [switchingTo, setSwitchingTo] = React.useState<string | null>(null)

  const currentPlan = currentPlanId ? planById(currentPlanId) : null
  const targetPlan = switchingTo ? planById(switchingTo) : null

  async function changePlan(planId: string) {
    if (busy) return
    setBusy(planId)
    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change', planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not change plan')
      setSwitchingTo(null)
      toast.success(`Switched to ${planById(planId)?.name ?? 'the new plan'}.`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change plan')
    } finally {
      setBusy(null)
    }
  }

  async function checkout(kind: 'plan' | 'pack', id: string) {
    if (busy) return
    setBusy(id)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not start checkout')
      window.location.href = data.url as string
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start checkout')
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          Monthly plans
        </div>
        <div className="text-[11.5px] mb-2.5" style={{ color: 'var(--ink-3)' }}>
          Credits are granted every month and roll over while your plan is active.
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {PLANS.map((plan) => {
            const docs = Math.floor(plan.monthlyCredits / DOCUMENT_CREDIT_COST)
            const isCurrent = plan.id === currentPlanId
            return (
              <div
                key={plan.id}
                className={cn('card flex flex-col', plan.highlight && 'card-accent')}
                style={{ borderRadius: 14, padding: '18px 16px' }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                    {plan.name}
                  </div>
                  {plan.highlight && (
                    <span
                      className="text-[10px] font-medium uppercase tracking-wide"
                      style={{ color: 'var(--accent-base)' }}
                    >
                      Popular
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="mono-num text-[22px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                    ${plan.priceUsd}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    /mo
                  </span>
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: 'var(--ink-2)' }}>
                  <span className="mono-num font-medium">{formatNumber(plan.monthlyCredits)}</span>{' '}
                  credits · ~{docs} documents
                </div>
                <div className="text-[11px] mt-1.5 flex-1" style={{ color: 'var(--ink-3)' }}>
                  {plan.blurb}
                </div>
                <button
                  type="button"
                  disabled={busy !== null || isCurrent}
                  onClick={() =>
                    canSwitchPlan ? setSwitchingTo(plan.id) : checkout('plan', plan.id)
                  }
                  className="mt-3 rounded-[8px] text-[12px] font-medium transition-opacity disabled:opacity-60"
                  style={{
                    padding: '7px 0',
                    background: isCurrent ? 'rgba(28,24,20,0.06)' : 'var(--accent-base)',
                    color: isCurrent ? 'var(--ink-2)' : '#fff',
                    cursor: busy || isCurrent ? 'default' : 'pointer',
                  }}
                >
                  {isCurrent
                    ? 'Current plan'
                    : busy === plan.id
                      ? canSwitchPlan
                        ? 'Switching…'
                        : 'Opening…'
                      : canSwitchPlan
                        ? 'Switch to this'
                        : 'Subscribe'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          One-time packs
        </div>
        <div className="text-[11.5px] mb-2.5" style={{ color: 'var(--ink-3)' }}>
          Same credits, same price — bought once, with nothing recurring.
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {PACKS.map((pack) => (
            <div key={pack.id} className="card flex flex-col" style={{ borderRadius: 14, padding: '18px 16px' }}>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                {pack.name}
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="mono-num text-[22px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                  ${pack.priceUsd}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  one-time
                </span>
              </div>
              <div className="text-[11.5px] mt-1" style={{ color: 'var(--ink-2)' }}>
                <span className="mono-num font-medium">{formatNumber(pack.credits)}</span> credits
              </div>
              <div className="text-[11px] mt-1.5 flex-1" style={{ color: 'var(--ink-3)' }}>
                {pack.blurb}
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => checkout('pack', pack.id)}
                className="mt-3 rounded-[8px] text-[12px] font-medium transition-opacity disabled:opacity-60"
                style={{
                  padding: '7px 0',
                  background: 'rgba(28,24,20,0.06)',
                  color: 'var(--ink-1)',
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                {busy === pack.id ? 'Opening…' : 'Buy credits'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={switchingTo !== null}
        onOpenChange={(open) => !open && !busy && setSwitchingTo(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col gap-2 pt-1">
            <DialogTitle className="text-[15px] font-semibold" style={{ color: 'var(--ink-1)' }}>
              Switch to {targetPlan?.name}?
            </DialogTitle>
            <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              {currentPlan ? `You're on ${currentPlan.name} ($${currentPlan.priceUsd}/mo). ` : ''}
              You won&apos;t be charged or refunded today, and your current credits stay as they
              are. From your next renewal you&apos;ll be billed{' '}
              <span className="mono-num font-medium">${targetPlan?.priceUsd}</span>/mo and receive{' '}
              <span className="mono-num font-medium">
                {targetPlan ? formatNumber(targetPlan.monthlyCredits) : ''}
              </span>{' '}
              credits each month.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setSwitchingTo(null)}
                className="flex-1 rounded-[8px] text-[12px] font-medium"
                style={{
                  padding: '8px 0',
                  background: 'rgba(28,24,20,0.06)',
                  color: 'var(--ink-2)',
                }}
              >
                Keep {currentPlan?.name ?? 'current'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => switchingTo && changePlan(switchingTo)}
                className="flex-1 rounded-[8px] text-[12px] font-medium"
                style={{
                  padding: '8px 0',
                  background: 'var(--accent-base)',
                  color: '#fff',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Switching…' : 'Switch plan'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
