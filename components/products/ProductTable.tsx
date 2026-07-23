import type { Product } from '@/types'
import { Icon } from '@/components/ui/icon'
import { productTag, formatPrice } from './ProductCard'

interface Props {
  products: Product[]
  onSelect: (product: Product) => void
}

export function ProductTable({ products, onSelect }: Props) {
  return (
    <div className="card overflow-hidden">
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: '2fr 1fr 0.8fr 1fr 30px',
          padding: '10px 18px',
          fontSize: 10.5,
          color: 'var(--ink-3)',
          borderBottom: '0.5px solid var(--line-1)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono), monospace',
        }}
      >
        <div>Name</div>
        <div>Category</div>
        <div>Tag</div>
        <div>Price</div>
        <div />
      </div>
      {products.map((p, i) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p)}
          className="grid items-center text-left w-full hover:bg-[rgba(28,24,20,0.025)] transition-colors"
          style={{
            gridTemplateColumns: '2fr 1fr 0.8fr 1fr 30px',
            padding: '12px 18px',
            borderBottom:
              i < products.length - 1 ? '0.5px solid var(--line-1)' : 'none',
          }}
        >
          <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink-1)' }}>
            {p.name}
            {p.description && (
              <div
                className="text-[11px] truncate"
                style={{ color: 'var(--ink-3)', marginTop: 2 }}
              >
                {p.description}
              </div>
            )}
          </div>
          <div className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            {p.category}
          </div>
          <div>
            <span className="pill pill-mono">{productTag(p)}</span>
          </div>
          <div
            className="mono-num text-[12.5px] font-medium"
            style={{ color: 'var(--ink-1)' }}
          >
            {formatPrice(p)}
          </div>
          <span style={{ color: 'var(--ink-3)' }}>
            <Icon name="chevR" size={12} />
          </span>
        </button>
      ))}
    </div>
  )
}
