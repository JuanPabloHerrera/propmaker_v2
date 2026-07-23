'use client'

import * as React from 'react'
import { AuroraOrb } from '@/components/ui/aurora-orb'

interface Props {
  open: boolean
  title: string
  subtitle: string
}

/**
 * Full-screen "the agent is working" overlay, shown while a document is being
 * generated or exported. The build runs server-side but the auto-download /
 * auto-navigate only fires while this page stays open — hence the explicit
 * "keep this page open" instruction.
 */
export function AgentWorkingOverlay({ open, title, subtitle }: Props) {
  if (!open) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center glass-strong pm-no-print"
      style={{
        // Inline `position`/insets: `.glass-strong` sets position:relative and
        // overrides Tailwind's `fixed`/`inset-0` (it loads after the Tailwind
        // import in globals.css), which would leave this in normal flow.
        position: 'fixed',
        inset: 0,
        background: 'rgba(255, 252, 245, 0.72)',
      }}
    >
      <div className="flex flex-col items-center text-center" style={{ maxWidth: 420, padding: 24 }}>
        <AuroraOrb size={120} />
        <div
          className="mt-6 text-[15px] font-semibold"
          style={{ color: 'var(--ink-1)' }}
        >
          {title}
        </div>
        <div className="mt-2 text-[12.5px]" style={{ color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {subtitle}
        </div>
        <div
          className="pm-eyebrow mt-5"
          style={{ color: 'var(--accent-base)' }}
        >
          Keep this page open
        </div>
      </div>
    </div>
  )
}
