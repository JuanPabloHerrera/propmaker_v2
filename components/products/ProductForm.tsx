'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CategoryCombobox } from './CategoryCombobox'
import { toast } from 'sonner'
import { PRICE_UNIT_LABELS, type Product, type PriceUnit } from '@/types'
import Link from 'next/link'

interface Props {
  product?: Product
  categories: string[]
}

export function ProductForm({ product, categories }: Props) {
  const router = useRouter()
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [priceAmount, setPriceAmount] = useState<string>(
    product?.price_amount != null ? String(product.price_amount) : ''
  )
  const [priceUnit, setPriceUnit] = useState<PriceUnit | ''>(product?.price_unit ?? '')
  const [currency, setCurrency] = useState(product?.currency ?? 'MXN')
  const [notes, setNotes] = useState(product?.notes ?? '')
  const [active, setActive] = useState(product?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isEdit = !!product

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const body = {
      name,
      category,
      description: description || null,
      price_amount: priceAmount ? Number(priceAmount) : null,
      price_unit: priceUnit || null,
      currency,
      notes: notes || null,
      active,
    }

    const url = isEdit ? `/api/products/${product.id}` : '/api/products'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to save')
      return
    }

    toast.success(isEdit ? 'Product updated' : 'Product created')
    router.push('/products')
    router.refresh()
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete "${product.name}"?`)) return
    setDeleting(true)
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success('Deleted')
      router.push('/products')
      router.refresh()
    } else {
      toast.error('Failed to delete')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="glass p-6 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-[#1d1d1f]">Name</Label>
          <Input
            id="name"
            placeholder="e.g. NOM-035 Compliance Audit"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[#1d1d1f]">Category</Label>
          <CategoryCombobox value={category} onChange={setCategory} suggestions={categories} />
          <p className="text-xs text-[#6e6e73]">Used to scope which products are matched in a given meeting.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm font-medium text-[#1d1d1f]">Description</Label>
          <Textarea
            id="description"
            placeholder="What this offering covers, deliverables, scope notes…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="resize-none rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white text-sm"
          />
        </div>
      </div>

      <div className="glass p-6 space-y-5">
        <Label className="text-sm font-medium text-[#1d1d1f]">Pricing</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs text-[#6e6e73]">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
              className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency" className="text-xs text-[#6e6e73]">Currency</Label>
            <Input
              id="currency"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit" className="text-xs text-[#6e6e73]">Unit</Label>
            <select
              id="unit"
              value={priceUnit}
              onChange={(e) => setPriceUnit(e.target.value as PriceUnit | '')}
              className="h-10 w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white px-3 text-sm text-[#1d1d1f]"
            >
              <option value="">—</option>
              {(Object.keys(PRICE_UNIT_LABELS) as PriceUnit[]).map((u) => (
                <option key={u} value={u}>{PRICE_UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-sm font-medium text-[#1d1d1f]">Internal notes</Label>
          <Textarea
            id="notes"
            placeholder="Anything the AI should know when matching this to a conversation…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="resize-none rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[#1d1d1f] cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-[#d2d2d7]"
          />
          Active (included when matching to meetings)
        </label>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/products" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f]">
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl border-red-200 text-red-600 h-10 px-4 text-sm hover:bg-red-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white h-10 px-5 text-sm font-medium"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </div>
    </form>
  )
}
