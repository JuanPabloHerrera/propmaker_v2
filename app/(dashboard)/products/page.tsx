import { createClient } from '@/lib/supabase/server'
import { CatalogToolbar } from '@/components/products/CatalogToolbar'
import type { Product } from '@/types'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const list = (products ?? []) as Product[]
  const categories = Array.from(new Set(list.map((p) => p.category))).sort()

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <CatalogToolbar products={list} categories={categories} />
    </div>
  )
}
