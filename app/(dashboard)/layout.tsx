import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SidebarSignOut } from '@/components/dashboard/SidebarSignOut'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-[#d2d2d7] flex flex-col">
        <div className="px-5 py-5 border-b border-[#d2d2d7]">
          <h1 className="text-base font-semibold text-[#1d1d1f] tracking-tight">PropCopilot</h1>
          <p className="text-xs text-[#6e6e73] mt-0.5">{user.email}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
          >
            <span className="text-base">📋</span>
            Meetings
          </Link>
          <Link
            href="/meetings/new"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
          >
            <span className="text-base">＋</span>
            New Meeting
          </Link>
        </nav>

        <div className="p-3 border-t border-[#d2d2d7]">
          <SidebarSignOut />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
