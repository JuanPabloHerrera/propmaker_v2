import type { Product } from '@/types'
import { PRICE_UNIT_LABELS } from '@/types'
import { Icon } from '@/components/ui/icon'

type ProductTag = 'PACKAGE' | 'ADD-ON' | 'RETAINER'

export function productTag(product: Product): ProductTag {
  if (product.price_unit === 'month') return 'RETAINER'
  if (product.price_unit === 'fixed' || product.price_unit === 'project') return 'PACKAGE'
  return 'ADD-ON'
}

export function formatPrice(product: Product): string {
  if (product.price_amount == null) return '—'
  const amount = product.price_amount.toLocaleString()
  const unit = product.price_unit === 'month' ? '/mo' : ''
  return `${product.currency} ${amount}${unit}`
}

export function ProductCard({
  product,
  onSelect,
}: {
  product: Product
  onSelect: (product: Product) => void
}) {
  const tag = productTag(product)
  const isRetainer = tag === 'RETAINER'

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="card p-4 flex flex-col gap-2.5 text-left hover:shadow-[0_6px_22px_rgba(28,22,14,0.10)] transition-shadow"
    >
      <div className="flex items-center justify-between">
        <span
          className="pill pill-mono"
          style={{
            background: isRetainer ? 'rgba(77,138,107,0.10)' : 'rgba(28,24,20,0.05)',
            color: isRetainer ? 'var(--accent-base)' : 'var(--ink-3)',
            borderColor: isRetainer ? 'rgba(77,138,107,0.2)' : 'var(--line-1)',
          }}
        >
          {tag}
        </span>
        <span style={{ color: 'var(--ink-3)' }}>
          <Icon name="more" />
        </span>
      </div>
      <div
        className="truncate"
        style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink-1)' }}
      >
        {product.name}
      </div>
      {product.description && (
        <div
          className="line-clamp-2"
          style={{
            fontSize: 11.5,
            color: 'var(--ink-2)',
            lineHeight: 1.5,
            minHeight: 36,
          }}
        >
          {product.description}
        </div>
      )}
      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 4,
          paddingTop: 10,
          borderTop: '0.5px solid var(--line-1)',
        }}
      >
        <span
          className="mono-num"
          style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
        >
          {product.category}
          {product.price_unit ? ` · ${PRICE_UNIT_LABELS[product.price_unit]}` : ''}
        </span>
        <span
          className="mono-num"
          style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)' }}
        >
          {formatPrice(product)}
        </span>
      </div>
    </button>
  )
}
