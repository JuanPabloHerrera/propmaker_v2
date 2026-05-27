import { createClient } from '@/lib/supabase/server'

export interface SidebarCounts {
  meetings: number
  products: number
  proposals: number
}

export async function getSidebarCounts(userId: string): Promise<SidebarCounts> {
  const supabase = await createClient()

  const [meetings, products, proposals] = await Promise.all([
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
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  return {
    meetings: meetings.count ?? 0,
    products: products.count ?? 0,
    proposals: proposals.count ?? 0,
  }
}
