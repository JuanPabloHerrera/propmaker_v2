'use client'

import * as React from 'react'
import type { Product } from '@/types'
import { Icon } from '@/components/ui/icon'

interface Props {
  products: Product[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function ProductAttachList({ products, selectedIds, onChange }: Props) {
  const [expanded, setExpanded] = React.useState(false)
  const visible = expanded ? products : products.slice(0, 4)

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id))
    else onChange([...selectedIds, id])
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          Attach products
        </div>
        <span className="pill pill-mono">
          {selectedIds.length} OF {products.length}
        </span>
      </div>
      {products.length === 0 ? (
        <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          No active products in your catalog yet. Add some from{' '}
          <a href="/products" className="underline">
            Catalog
          </a>
          .
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {visible.map((p) => {
              const on = selectedIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex items-center gap-2.5 text-left transition-colors"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '0.5px solid var(--line-1)',
                    background: on ? 'var(--accent-tint)' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <div className={`cbox ${on ? 'on' : ''}`}>
                    {on && <Icon name="check" size={10} strokeWidth={1.6} />}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate" style={{ color: 'var(--ink-1)' }}>
                      {p.name}
                    </div>
                    <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                      {p.category}
                    </div>
                  </div>
                  <span
                    className="mono-num"
                    style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
                  >
                    {p.price_amount != null
                      ? `${p.currency} ${p.price_amount.toLocaleString()}`
                      : '—'}
                  </span>
                </button>
              )
            })}
          </div>
          {products.length > 4 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-center mt-2"
              style={{
                padding: '6px 9px',
                fontSize: 11.5,
                color: 'var(--ink-2)',
              }}
            >
              {expanded ? 'Show less' : `Browse all ${products.length} products`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
