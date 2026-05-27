'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { Checklist, type ChecklistItem } from '@/components/ui/checklist'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/ui/pill'

interface OnboardingHeroProps {
  hasProfile: boolean
  hasProducts: boolean
}

export function OnboardingHero({ hasProfile, hasProducts }: OnboardingHeroProps) {
  const router = useRouter()
  const [skipping, setSkipping] = React.useState(false)

  async function handleSkip() {
    setSkipping(true)
    try {
      const res = await fetch('/api/profile/onboard', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to skip onboarding')
      router.push('/')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setSkipping(false)
    }
  }

  const steps: ChecklistItem[] = [
    {
      id: '1',
      title: 'Set up your profile',
      description: 'Company name, signature, brand voice — the stuff every proposal needs.',
      state: hasProfile ? 'done' : 'pending',
      numbered: true,
      index: 1,
      trailing: hasProfile ? <Pill variant="ok">Done</Pill> : undefined,
    },
    {
      id: '2',
      title: 'Add your products & services',
      description: "Mix of one-offs, packages, retainers. We'll match them to each meeting.",
      state: hasProducts ? 'done' : 'pending',
      numbered: true,
      index: 2,
      trailing: hasProducts ? <Pill variant="ok">Done</Pill> : undefined,
    },
    {
      id: '3',
      title: 'Connect a calendar (optional)',
      description: 'PropMaker can auto-join your scheduled calls.',
      state: 'pending',
      numbered: true,
      index: 3,
    },
    {
      id: '4',
      title: 'Run your first meeting',
      description: 'In-person or video — your call.',
      state: 'pending',
      numbered: true,
      index: 4,
    },
  ]

  return (
    <div className="min-h-screen lg-shell flex items-center justify-center">
      <div
        style={{
          width: 560,
          padding: '36px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Hero icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background:
              'linear-gradient(135deg, var(--accent-base) 0%, var(--accent-2) 60%, #e6c992 100%)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 8px 32px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.5)',
            marginBottom: 24,
            color: 'white',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <path
              d="M11 23V11h6a4 4 0 010 8h-3"
              stroke="white"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="pm-eyebrow">Welcome to PropMaker</div>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            margin: '4px 0 10px',
            textAlign: 'center',
            color: 'var(--ink-1)',
          }}
        >
          Turn every meeting into a&nbsp;proposal.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--ink-2)',
            textAlign: 'center',
            maxWidth: 460,
            lineHeight: 1.55,
            marginBottom: 32,
          }}
        >
          PropMaker listens in on your calls, takes private notes, and drafts a polished proposal —
          using the products and services you sell.
        </p>

        <GlassCard style={{ width: '100%', padding: 18, marginBottom: 20 }}>
          <Checklist items={steps} />
        </GlassCard>

        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={() => toast.info('Calendar integration is coming soon.')}
            className="flex-1 inline-flex items-center justify-center gap-2 text-white font-medium"
            style={{
              height: 40,
              padding: '0 16px',
              fontSize: 13.5,
              borderRadius: 9,
              background:
                'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
              border: '0.5px solid rgba(77, 138, 107, 0.6)',
              boxShadow:
                '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <Icon name="cal" size={14} />
            Connect calendar
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={skipping}
            className="flex-1 inline-flex items-center justify-center font-medium disabled:opacity-50"
            style={{
              height: 40,
              padding: '0 16px',
              fontSize: 13.5,
              borderRadius: 9,
              color: 'var(--ink-1)',
              background: 'rgba(255, 255, 255, 0.6)',
              border: '0.5px solid rgba(28, 24, 20, 0.10)',
              boxShadow:
                '0 1px 2px rgba(28, 22, 14, 0.06), inset 0 0.5px 0 rgba(255, 255, 255, 0.7)',
            }}
          >
            {skipping ? 'Skipping…' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  )
}
