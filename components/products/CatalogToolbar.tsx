'use client'

import * as React from 'react'
import Link from 'next/link'
import type { Product } from '@/types'
import { Icon } from '@/components/ui/icon'
import { Segmented } from '@/components/ui/segmented'
import { ProductCard } from './ProductCard'
import { ProductTable } from './ProductTable'
import { cn } from '@/lib/utils'

interface Props {
  products: Product[]
  categories: string[]
}

type ViewMode = 'grid' | 'table'

export function CatalogToolbar({ products, categories }: Props) {
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState<string>('All')
  const [view, setView] = React.useState<ViewMode>('grid')

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== 'All' && p.category !== category) return false
      if (!term) return true
      return (
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.description?.toLowerCase().includes(term) ?? false)
      )
    })
  }, [products, search, category])

  const cats = ['All', ...categories]

  return (
    <>
      <div className="flex items-end justify-between gap-4 mb-[22px]">
        <div>
          <div className="pm-eyebrow">
            Library · {products.length} item{products.length !== 1 ? 's' : ''}
          </div>
          <h1 className="pm-h1">Products &amp; Services</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Segmented<ViewMode>
            items={[
              { value: 'grid', label: 'Grid' },
              { value: 'table', label: 'Table' },
            ]}
            value={view}
            onChange={setView}
          />
          <Link
            href="/products/new"
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
            <Icon name="plus" />
            New product
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div
          className="glass-soft flex items-center gap-1.5"
          style={{ padding: '0 10px', height: 30, width: 260 }}
        >
          <span style={{ color: 'var(--ink-3)' }}>
            <Icon name="search" size={13} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog…"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 12, color: 'var(--ink-1)' }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'pill cursor-pointer transition-colors',
                category === c && 'pill-accent',
              )}
              style={{ height: 26, fontSize: 11.5, padding: '0 12px' }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 flex flex-col items-center text-center">
          <div
            className="text-[13px] font-semibold mb-1"
            style={{ color: 'var(--ink-1)' }}
          >
            {products.length === 0 ? 'No products yet' : 'No matches'}
          </div>
          <div className="text-[12px] mb-4" style={{ color: 'var(--ink-3)' }}>
            {products.length === 0
              ? 'Add the offerings you sell — PropMaker uses these as building blocks for proposals.'
              : 'Try a different search or category.'}
          </div>
          {products.length === 0 && (
            <Link
              href="/products/new"
              className="inline-flex items-center gap-1.5 text-white font-medium"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                fontSize: 12.5,
                background:
                  'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
              }}
            >
              <Icon name="plus" />
              Add your first product
            </Link>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <ProductTable products={filtered} />
      )}
    </>
  )
}
