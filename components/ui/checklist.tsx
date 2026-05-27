import * as React from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

export type ChecklistItemState = 'done' | 'active' | 'pending'

export interface ChecklistItem {
  id: string
  title: string
  description?: string
  state: ChecklistItemState
  numbered?: boolean
  index?: number
  trailing?: React.ReactNode
}

interface ChecklistProps {
  items: ChecklistItem[]
  className?: string
}

function Marker({ item }: { item: ChecklistItem }) {
  if (item.state === 'done') {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, var(--accent-2), var(--accent-base))',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 1px 2px var(--accent-glow)',
        }}
      >
        <Icon name="check" size={12} strokeWidth={1.6} />
      </div>
    )
  }
  if (item.state === 'active') {
    return (
      <>
        <style>{`@keyframes pm-spin { to { transform: rotate(360deg); } }`}</style>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '1.6px solid var(--accent-base)',
            borderTopColor: 'transparent',
            animation: 'pm-spin 0.9s linear infinite',
          }}
        />
      </>
    )
  }
  // pending
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'rgba(28, 24, 20, 0.06)',
        color: 'var(--ink-3)',
        display: 'grid',
        placeItems: 'center',
        fontSize: 10.5,
        fontWeight: 600,
        boxShadow: 'inset 0 0.5px 0 rgba(255, 255, 255, 0.6)',
      }}
    >
      {item.numbered ? item.index : ''}
    </div>
  )
}

export function Checklist({ items, className }: ChecklistProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-3">
          <Marker item={it} />
          <div className="flex flex-col min-w-0 flex-1">
            <div
              className="text-[13px]"
              style={{
                color: it.state === 'pending' ? 'var(--ink-3)' : 'var(--ink-1)',
                fontWeight: it.state === 'active' ? 500 : 400,
              }}
            >
              {it.title}
            </div>
            {it.description && (
              <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                {it.description}
              </div>
            )}
          </div>
          {it.trailing}
        </div>
      ))}
    </div>
  )
}
