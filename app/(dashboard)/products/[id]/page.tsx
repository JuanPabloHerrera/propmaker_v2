import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/ProductForm'
import type { Product } from '@/types'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: product }, { data: catRows }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).single(),
    supabase.from('products').select('category'),
  ])

  if (!product) notFound()

  const categories = Array.from(
    new Set(((catRows ?? []) as Pick<Product, 'category'>[]).map((p) => p.category))
  ).sort()

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <Link href="/products" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
          ← Back
        </Link>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mt-3">Edit product</h2>
      </div>

      <ProductForm product={product as Product} categories={categories} />
    </div>
  )
}
