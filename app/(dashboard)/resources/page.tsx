import { createClient } from '@/lib/supabase/server'
import { ServicesSection } from '@/components/resources/ServicesSection'
import { ReferenceFilesSection } from '@/components/resources/ReferenceFilesSection'
import type { Product } from '@/types'

/**
 * Resources — the merged home for the two things that feed proposal generation:
 * the services catalog and the reference-file library. Replaces the separate
 * /products and /references routes.
 */
export default async function ResourcesPage() {
  const supabase = await createClient()

  // RLS scopes this to the signed-in user.
  const { data } = await supabase
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const products = (data ?? []) as Product[]
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)))

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <div className="pm-eyebrow">Library</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        Resources
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 26, maxWidth: 660 }}>
        What the agent draws on when it writes a proposal: the services you sell, and the past work it
        should sound like.
      </p>

      <div className="flex flex-col" style={{ gap: 34 }}>
        <ServicesSection products={products} categories={categories} />
        <div style={{ borderTop: '0.5px solid var(--line-1)' }} />
        <ReferenceFilesSection />
      </div>
    </div>
  )
}
