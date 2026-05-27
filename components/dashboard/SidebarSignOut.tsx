'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

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
      type="button"
      onClick={signOut}
      className="w-full flex items-center gap-[9px] rounded-[7px] transition-colors hover:bg-[rgba(28,24,20,0.04)]"
      style={{
        padding: '6px 10px',
        fontSize: 12.5,
        color: 'var(--ink-2)',
      }}
    >
      <span style={{ color: 'var(--ink-3)' }}>
        <Icon name="signout" />
      </span>
      Sign out
    </button>
  )
}
