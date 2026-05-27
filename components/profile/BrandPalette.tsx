'use client'

import * as React from 'react'
import { Icon } from '@/components/ui/icon'
import { pickBrandTokens } from '@/lib/brand'

interface BrandPaletteProps {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
}

const DEFAULT_SLOTS = ['#1c1814', '#f6f1e8', '#4d8a6b', '#c97e54', '#5d8a73']
const SLOT_LABELS = ['Ink', 'Paper', 'Accent', 'Secondary', 'Tertiary', 'Extra']

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
            title={`${SLOT_LABELS[i] ?? `Slot ${i + 1}`} · ${c}`}
          >
            <input
              type="color"
              value={c}
              onChange={(e) => updateAt(i, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label={`${SLOT_LABELS[i] ?? `Brand color ${i + 1}`} (${c})`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                removeAt(i)
              }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center"
              style={{ color: 'var(--ink-2)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
              aria-label={`Remove ${SLOT_LABELS[i] ?? `color ${i + 1}`}`}
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
      <BrandPreview colors={slots} />
      <div className="text-[11px] mt-2" style={{ color: 'var(--ink-3)' }}>
        Slot 1 sets body ink, slot 3 sets the proposal accent, slot 4 secondary.
      </div>
    </div>
  )
}

function BrandPreview({ colors }: { colors: string[] }) {
  const tokens = pickBrandTokens(colors)
  const ink = tokens.ink ?? 'var(--ink-1)'
  const accent = tokens.accent ?? 'var(--accent-base)'
  const accent2 = tokens.accent2 ?? accent
  return (
    <div
      className="flex items-center gap-3 rounded-lg p-2"
      style={{
        background: '#ffffff',
        border: '0.5px solid var(--line-1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
      aria-label="Proposal preview"
    >
      <div className="flex flex-col flex-1 min-w-0">
        <div style={{ color: ink, fontSize: 12, fontWeight: 600 }}>
          Sample proposal heading
        </div>
        <div style={{ color: accent, fontSize: 11, fontWeight: 500 }}>
          Accent link · 1.5×
        </div>
      </div>
      <div className="flex gap-1.5">
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            background: accent,
            boxShadow: 'inset 0 0 0 0.5px rgba(28,24,20,0.15)',
          }}
          aria-hidden="true"
        />
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            background: accent2,
            boxShadow: 'inset 0 0 0 0.5px rgba(28,24,20,0.15)',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
