'use client'

import * as React from 'react'
import { Pill } from '@/components/ui/pill'
import { Icon } from '@/components/ui/icon'

interface Props {
  value: string
  onChange: (v: string) => void
}

export function ContextTextarea({ value, onChange }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          Context for the agent
        </div>
        <Pill variant="accent">
          <Icon name="sparkle" size={12} />
          Background brief
        </Pill>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
        style={{ minHeight: 76, padding: '8px 11px', fontSize: 12.5, lineHeight: 1.5 }}
        placeholder="Anything the agent should know going in: company background, attendees' roles, budget signals, pain points, who owns sign-off."
      />
    </div>
  )
}
