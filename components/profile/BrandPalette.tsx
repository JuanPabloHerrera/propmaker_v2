'use client'

import * as React from 'react'
import { Icon } from '@/components/ui/icon'

interface BrandPaletteProps {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
}

const DEFAULT_SLOTS = ['#1c1814', '#f6f1e8', '#4d8a6b', '#c97e54', '#5d8a73']

export function BrandPalette({ value, onChange, max = 6 }: BrandPaletteProps) {
  const slots = React.useMemo(() => {
    const list = value.length ? value : DEFAULT_SLOTS
    return list.slice(0, max)
  }, [value, max])

  function updateAt(i: number, hex: string) {
    const next = [...slots]
    next[i] = hex
    onChange(next)
  }

  function add() {
    if (slots.length >= max) return
    onChange([...slots, '#cccccc'])
  }

  function removeAt(i: number) {
    onChange(slots.filter((_, idx) => idx !== i))
  }

  return (
    <div className="card p-[22px]">
      <div className="text-[13px] font-semibold mb-2.5" style={{ color: 'var(--ink-1)' }}>
        Brand colors
      </div>
      <div className="flex gap-2.5 flex-wrap mb-3">
        {slots.map((c, i) => (
          <label
            key={i}
            className="relative inline-grid place-items-center cursor-pointer group"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: c,
              boxShadow:
                'inset 0 0 0 0.5px rgba(28,24,20,0.15), 0 1px 2px rgba(0,0,0,0.06)',
            }}
          >
            <input
              type="color"
              value={c}
              onChange={(e) => updateAt(i, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label={`Brand color ${i + 1}`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                removeAt(i)
              }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center"
              style={{ color: 'var(--ink-2)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
              aria-label="Remove color"
            >
              <Icon name="close" size={9} strokeWidth={1.6} />
            </button>
          </label>
        ))}
        {slots.length < max && (
          <button
            type="button"
            onClick={add}
            className="grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px dashed var(--line-1)',
              color: 'var(--ink-3)',
            }}
            aria-label="Add brand color"
          >
            <Icon name="plus" />
          </button>
        )}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
        Used as accent swatches in generated proposals.
      </div>
    </div>
  )
}
