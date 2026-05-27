import * as React from 'react'
import { Icon } from '@/components/ui/icon'

interface Props {
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function AgentSuggestionCard({ title = 'Agent suggestion', children, action }: Props) {
  return (
    <div
      className="card card-accent"
      style={{
        padding: 18,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'var(--accent-base)' }}>
          <Icon name="sparkle" size={14} />
        </span>
        <div className="text-[12px] font-semibold" style={{ color: 'var(--accent-base)' }}>
          {title}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-1)', lineHeight: 1.5 }}>{children}</div>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  )
}
