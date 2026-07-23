'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'
import { CategoryCombobox } from '@/components/products/CategoryCombobox'
import { PRICE_UNIT_LABELS, type Product, type PriceUnit } from '@/types'

interface Props {
  open: boolean
  /** The service being edited; omit to create a new one. */
  product?: Product | null
  categories: string[]
  onClose: () => void
  /** Called after a successful create / update / delete so the list can refresh. */
  onSaved: () => void
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--ink-2)',
  marginBottom: 6,
}

/**
 * Create / edit a catalog service in a slide-over on the Resources page.
 * Replaces the old standalone /products/new and /products/[id] pages.
 */
export function ServiceFormDrawer({ open, product, categories, onClose, onSaved }: Props) {
  const isEdit = !!product
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [priceAmount, setPriceAmount] = React.useState('')
  const [priceUnit, setPriceUnit] = React.useState<PriceUnit | ''>('')
  const [currency, setCurrency] = React.useState('MXN')
  const [notes, setNotes] = React.useState('')
  const [active, setActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  // Re-seed the fields each time the drawer opens so switching between services
  // (or from edit to create) never shows the previous one's values.
  React.useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setCategory(product?.category ?? '')
    setDescription(product?.description ?? '')
    setPriceAmount(product?.price_amount != null ? String(product.price_amount) : '')
    setPriceUnit(product?.price_unit ?? '')
    setCurrency(product?.currency ?? 'MXN')
    setNotes(product?.notes ?? '')
    setActive(product?.active ?? true)
  }, [open, product])

  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !deleting) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, saving, deleting, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(isEdit ? `/api/products/${product!.id}` : '/api/products', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          description: description || null,
          price_amount: priceAmount ? Number(priceAmount) : null,
          price_unit: priceUnit || null,
          currency,
          notes: notes || null,
          active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success(isEdit ? 'Service updated.' : 'Service created.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!product || deleting) return
    if (!confirm(`Delete "${product.name}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete')
      toast.success('Service deleted.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  const busy = saving || deleting

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit service' : 'New service'}
      className="fixed inset-0 z-40 pm-no-print"
      style={{ position: 'fixed', inset: 0 }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => !busy && onClose()}
        className="bg-black/20"
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* `position` must stay inline: `.glass-strong` declares position:relative
          as unlayered CSS, which outranks Tailwind's layered `absolute` utility
          and would drop this panel back into normal flow. */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col glass-strong"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(520px, 94vw)',
          borderRadius: 0,
          borderLeft: '0.5px solid var(--line-1)',
        }}
      >
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '14px 18px',
            borderBottom: '0.5px solid var(--line-1)',
            background: 'rgba(255, 252, 245, 0.55)',
          }}
        >
          <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
            {isEdit ? 'Edit service' : 'New service'}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="grid place-items-center rounded-md hover:bg-[rgba(28,24,20,0.04)] disabled:opacity-50"
            style={{ width: 28, height: 28, color: 'var(--ink-2)' }}
          >
            <Icon name="close" size={12} strokeWidth={1.6} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto" style={{ padding: 18 }}>
          <label className="block">
            <span style={labelStyle}>Name</span>
            <input
              className="field"
              style={{ height: 36, fontSize: 13 }}
              placeholder="e.g. NOM-035 Compliance Audit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <div className="mt-3">
            <span style={labelStyle}>Category</span>
            <CategoryCombobox value={category} onChange={setCategory} suggestions={categories} />
          </div>

          <label className="block mt-3">
            <span style={labelStyle}>Description</span>
            <textarea
              className="field"
              style={{ minHeight: 90, fontSize: 12.5, padding: 10, resize: 'vertical' }}
              placeholder="What this offering covers, deliverables, scope notes…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-3 gap-2.5 mt-3">
            <label className="block">
              <span style={labelStyle}>Amount</span>
              <input
                className="field"
                style={{ height: 36, fontSize: 13 }}
                type="number"
                step="0.01"
                placeholder="0.00"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
              />
            </label>
            <label className="block">
              <span style={labelStyle}>Currency</span>
              <input
                className="field"
                style={{ height: 36, fontSize: 13 }}
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </label>
            <label className="block">
              <span style={labelStyle}>Unit</span>
              <select
                className="field"
                style={{ height: 36, fontSize: 12.5 }}
                value={priceUnit}
                onChange={(e) => setPriceUnit(e.target.value as PriceUnit | '')}
              >
                <option value="">—</option>
                {(Object.keys(PRICE_UNIT_LABELS) as PriceUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {PRICE_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block mt-3">
            <span style={labelStyle}>Internal notes</span>
            <textarea
              className="field"
              style={{ minHeight: 70, fontSize: 12.5, padding: 10, resize: 'vertical' }}
              placeholder="Anything the AI should know when matching this to a conversation…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <label
            className="flex items-center gap-2 mt-3.5 cursor-pointer"
            style={{ fontSize: 12.5, color: 'var(--ink-1)' }}
          >
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active — included when matching to meetings
          </label>
        </div>

        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '12px 18px',
            borderTop: '0.5px solid var(--line-1)',
            background: 'rgba(255, 252, 245, 0.55)',
          }}
        >
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="font-medium disabled:opacity-50"
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 8,
                fontSize: 12.5,
                color: 'var(--rec)',
                background: 'rgba(176,52,52,0.08)',
                border: '0.5px solid rgba(176,52,52,0.22)',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="font-medium disabled:opacity-50"
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 8,
                fontSize: 12.5,
                color: 'var(--ink-1)',
                background: 'rgba(255,255,255,0.6)',
                border: '0.5px solid rgba(28,24,20,0.10)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 font-medium text-white disabled:opacity-60"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                fontSize: 12.5,
                background:
                  'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                border: '0.5px solid rgba(77,138,107,0.6)',
                boxShadow:
                  '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create service'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
