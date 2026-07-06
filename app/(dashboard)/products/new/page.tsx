import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/ProductForm'
import type { Product } from '@/types'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('category')
  const categories = Array.from(new Set(((data ?? []) as Pick<Product, 'category'>[]).map((p) => p.category))).sort()

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <Link href="/products" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
          ← Back
        </Link>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mt-3">New product</h2>
        <p className="text-sm text-[#6e6e73] mt-0.5">An offering that PropMaker can recommend during proposal generation.</p>
      </div>

      <ProductForm categories={categories} />
    </div>
  )
}
