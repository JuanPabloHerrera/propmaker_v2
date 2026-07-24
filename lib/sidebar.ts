import { createClient } from '@/lib/supabase/server'

export interface SidebarCounts {
  meetings: number
  products: number
  documents: number
  references: number
  credits: number
}

export async function getSidebarCounts(userId: string): Promise<SidebarCounts> {
  const supabase = await createClient()

  const [meetings, products, documents, references, credits] = await Promise.all([
    supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('active', true),
    supabase
      .from('meeting_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('reference_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  return {
    meetings: meetings.count ?? 0,
    products: products.count ?? 0,
    documents: documents.count ?? 0,
    references: references.count ?? 0,
    credits: credits.data?.balance ?? 0,
  }
}
