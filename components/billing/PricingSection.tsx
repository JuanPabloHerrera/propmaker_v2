'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { DOCUMENT_CREDIT_COST, PACKS, PLANS } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'

interface PricingSectionProps {
  currentPlanId: string | null
}

export function PricingSection({ currentPlanId }: PricingSectionProps) {
  const [busy, setBusy] = React.useState<string | null>(null)

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
        <div className="text-[13px] font-semibold mb-2.5" style={{ color: 'var(--ink-1)' }}>
          Monthly plans
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
                  <span className="mono-num font-medium">{plan.monthlyCredits.toLocaleString()}</span>{' '}
                  credits · ~{docs} documents
                </div>
                <div className="text-[11px] mt-1.5 flex-1" style={{ color: 'var(--ink-3)' }}>
                  {plan.blurb}
                </div>
                <button
                  type="button"
                  disabled={busy !== null || isCurrent}
                  onClick={() => checkout('plan', plan.id)}
                  className="mt-3 rounded-[8px] text-[12px] font-medium transition-opacity disabled:opacity-60"
                  style={{
                    padding: '7px 0',
                    background: isCurrent ? 'rgba(28,24,20,0.06)' : 'var(--accent-base)',
                    color: isCurrent ? 'var(--ink-2)' : '#fff',
                    cursor: busy || isCurrent ? 'default' : 'pointer',
                  }}
                >
                  {isCurrent ? 'Current plan' : busy === plan.id ? 'Opening…' : 'Subscribe'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-[13px] font-semibold mb-2.5" style={{ color: 'var(--ink-1)' }}>
          One-time top-up
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
                <span className="mono-num font-medium">{pack.credits.toLocaleString()}</span> credits
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
    </div>
  )
}
