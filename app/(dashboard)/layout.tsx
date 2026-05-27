import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PMSidebar } from '@/components/layout/PMSidebar'
import { getSidebarCounts } from '@/lib/sidebar'

function initialsFor(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback.slice(0, 2).toUpperCase()
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || fallback.slice(0, 2).toUpperCase()
}

function nameFor(fullName: string | null | undefined, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim()
  return email.split('@')[0] || 'You'
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, onboarded_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // Onboarding gate: first-run users land on /welcome.
  if (!profile?.onboarded_at) redirect('/welcome')

  const counts = await getSidebarCounts(user.id)
  const email = user.email ?? ''
  const displayName = nameFor(profile?.full_name, email)

  return (
    <div className="flex h-screen lg-shell">
      <a
        href="#main-content"
        className="pm-skip-link"
      >
        Skip to main content
      </a>
      <PMSidebar
        user={{
          name: displayName,
          email,
          initials: initialsFor(profile?.full_name, email),
        }}
        counts={counts}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-auto min-w-0 focus:outline-none"
      >
        {children}
      </main>
    </div>
  )
}
