'use client'

import { ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'

interface Props {
  open: boolean
  side: 'left' | 'right'
  label: string
  width?: number
  onToggle: () => void
  children: ReactNode
}

export function CollapsiblePanel({ open, side, label, width = 320, onToggle, children }: Props) {
  return (
    <div
      className="shrink-0 transition-[width] duration-300 ease-out overflow-hidden"
      style={{
        width: open ? width : 0,
        background:
          side === 'left' ? 'rgba(255,253,247,0.30)' : 'rgba(77, 138, 107, 0.04)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderRight: side === 'left' ? '0.5px solid var(--line-1)' : undefined,
        borderLeft: side === 'right' ? '0.5px solid var(--line-1)' : undefined,
      }}
    >
      <div className="h-full flex flex-col" style={{ width }}>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

interface ReopenProps {
  side: 'left' | 'right'
  label: string
  onClick: () => void
}

export function CollapsedTab({ side, label, onClick }: ReopenProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group shrink-0 w-7 hover:bg-[rgba(255,255,255,0.5)] flex flex-col items-center justify-center transition-colors"
      style={{
        borderLeft: side === 'right' ? '0.5px solid var(--line-1)' : undefined,
        borderRight: side === 'left' ? '0.5px solid var(--line-1)' : undefined,
        background:
          side === 'left' ? 'rgba(255,253,247,0.30)' : 'rgba(77,138,107,0.04)',
      }}
      aria-label={`Expand ${label}`}
    >
      <span style={{ color: 'var(--ink-3)' }}>
        <Icon name={side === 'left' ? 'chevR' : 'chevL'} size={12} />
      </span>
      <span
        className="mt-2 uppercase tracking-wider [writing-mode:vertical-rl] rotate-180"
        style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-3)' }}
      >
        {label}
      </span>
    </button>
  )
}
