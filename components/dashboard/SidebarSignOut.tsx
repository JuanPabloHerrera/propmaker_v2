'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SidebarSignOut() {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
    >
      <span className="text-base">↩</span>
      Sign out
    </button>
  )
}
