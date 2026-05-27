'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedItem<V extends string = string> {
  value: V
  label: React.ReactNode
  ariaLabel?: string
}

interface SegmentedProps<V extends string> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: SegmentedItem<V>[]
  value: V
  onChange: (value: V) => void
}

export function Segmented<V extends string = string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: SegmentedProps<V>) {
  return (
    <div role="radiogroup" className={cn('seg', className)} {...rest}>
      {items.map((it) => {
        const selected = it.value === value
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={it.ariaLabel}
            className={selected ? 'on' : ''}
            onClick={() => onChange(it.value)}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
