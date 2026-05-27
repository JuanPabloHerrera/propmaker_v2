import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GreetingHeader } from '@/components/dashboard/GreetingHeader'
import { UpNextCard } from '@/components/dashboard/UpNextCard'
import { StatTile } from '@/components/dashboard/StatTile'
import { RecentMeetingsTable } from '@/components/dashboard/RecentMeetingsTable'
import type { Meeting } from '@/types'

interface Search {
  filter?: 'all' | 'proposals' | 'won' | 'archived'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const params = await searchParams
  const filter = params.filter ?? 'all'

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] ??
    user.email?.split('@')[0] ??
    'there'

  let query = supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15)

  if (filter === 'proposals') query = query.eq('deal_status', 'proposal_sent')
  else if (filter === 'won') query = query.eq('deal_status', 'won')

  const { data: meetingsData } = await query
  const meetings = (meetingsData ?? []) as Meeting[]

  // Up Next — first upcoming scheduled meeting
  const { data: nextData } = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', user.id)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)
  const upNext = (nextData?.[0] as Meeting | undefined) ?? null

  // Stats — this-month meetings, proposals out, close rate (last 30d)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [monthCount, propCount, wonCount, lostCount] = await Promise.all([
    supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('deal_status', 'proposal_sent'),
    supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('deal_status', 'won')
      .gte('updated_at', since30),
    supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('deal_status', 'lost')
      .gte('updated_at', since30),
  ])

  const won = wonCount.count ?? 0
  const lost = lostCount.count ?? 0
  const closeRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <GreetingHeader firstName={firstName} />

      {upNext && filter === 'all' && <UpNextCard meeting={upNext} />}

      {filter === 'all' && (
        <div className="grid grid-cols-3 gap-3 mb-[22px]">
          <StatTile
            label="This month"
            value={monthCount.count ?? 0}
            unit="meetings"
          />
          <StatTile
            label="Proposals out"
            value={propCount.count ?? 0}
            unit="pending"
          />
          <StatTile
            label="Close rate"
            value={closeRate ?? '—'}
            unit={closeRate != null ? '%' : ''}
            hint="Last 30 days"
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          {filter === 'proposals'
            ? 'Proposals sent'
            : filter === 'won'
              ? 'Won deals'
              : filter === 'archived'
                ? 'Archived'
                : 'Recent meetings'}
        </div>
      </div>

      <RecentMeetingsTable meetings={meetings} />
    </div>
  )
}
