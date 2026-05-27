import * as React from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Icon } from '@/components/ui/icon'

interface GreetingHeaderProps {
  firstName: string
}

function timeOfDayGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function GreetingHeader({ firstName }: GreetingHeaderProps) {
  const now = new Date()
  const greeting = timeOfDayGreeting(now.getHours())

  return (
    <div className="flex items-end justify-between gap-4 mb-[22px]">
      <div>
        <div className="pm-eyebrow">{format(now, 'EEEE, MMM d')}</div>
        <h1 className="pm-h1">
          {greeting}, {firstName}.
        </h1>
      </div>
      <div className="flex gap-2.5">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 font-medium"
          style={{
            height: 28,
            padding: '0 11px',
            borderRadius: 7,
            fontSize: 12.5,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
            boxShadow:
              '0 1px 2px rgba(28,22,14,0.06), inset 0 0.5px 0 rgba(255,255,255,0.7)',
          }}
        >
          <Icon name="box" />
          Catalog
        </Link>
        <Link
          href="/meetings/new"
          className="inline-flex items-center gap-1.5 font-medium text-white"
          style={{
            height: 28,
            padding: '0 14px',
            borderRadius: 7,
            fontSize: 12.5,
            background:
              'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
            border: '0.5px solid rgba(77,138,107,0.6)',
            boxShadow:
              '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >
          <Icon name="mic" />
          Start meeting
        </Link>
      </div>
    </div>
  )
}
