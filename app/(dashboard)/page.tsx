import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GreetingHeader } from '@/components/dashboard/GreetingHeader'
import { StatTile } from '@/components/dashboard/StatTile'
import { RecentMeetingsTable } from '@/components/dashboard/RecentMeetingsTable'
import type { Meeting } from '@/types'

const MEETINGS_PAGE_SIZE = 20

interface Search {
  filter?: 'all' | 'proposals' | 'won' | 'meetings'
  page?: string
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
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] ??
    user.email?.split('@')[0] ??
    'there'

  const isMeetingsView = filter === 'meetings'
  const wantsCount = isMeetingsView
  const from = isMeetingsView ? (page - 1) * MEETINGS_PAGE_SIZE : 0
  const to = isMeetingsView ? from + MEETINGS_PAGE_SIZE - 1 : 4

  let query = supabase
    .from('meetings')
    .select('*', wantsCount ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filter === 'proposals') query = query.eq('deal_status', 'proposal_sent')
  else if (filter === 'won') query = query.eq('deal_status', 'won')

  const { data: meetingsData, count: meetingsCount } = await query
  const meetings = (meetingsData ?? []) as Meeting[]
  const totalPages = isMeetingsView
    ? Math.max(1, Math.ceil((meetingsCount ?? 0) / MEETINGS_PAGE_SIZE))
    : 1

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
              : filter === 'meetings'
                ? 'Meetings'
                : 'Recent meetings'}
        </div>
        {isMeetingsView && (meetingsCount ?? 0) > 0 && (
          <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            {from + 1}–{Math.min(to + 1, meetingsCount ?? 0)} of {meetingsCount}
          </div>
        )}
      </div>

      <RecentMeetingsTable meetings={meetings} />

      {isMeetingsView && totalPages > 1 && (
        <MeetingsPagination page={page} totalPages={totalPages} />
      )}
    </div>
  )
}

function MeetingsPagination({
  page,
  totalPages,
}: {
  page: number
  totalPages: number
}) {
  const hasPrev = page > 1
  const hasNext = page < totalPages
  return (
    <div className="flex items-center justify-between mt-4">
      <PageLink
        href={`/?filter=meetings&page=${page - 1}`}
        disabled={!hasPrev}
        label="← Previous"
      />
      <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
        Page {page} of {totalPages}
      </div>
      <PageLink
        href={`/?filter=meetings&page=${page + 1}`}
        disabled={!hasNext}
        label="Next →"
      />
    </div>
  )
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string
  disabled: boolean
  label: string
}) {
  const base =
    'rounded-[7px] text-[12px] px-3 py-1.5 transition-colors border'
  if (disabled) {
    return (
      <span
        className={base}
        style={{
          color: 'var(--ink-3)',
          borderColor: 'var(--line-1)',
          opacity: 0.5,
          cursor: 'not-allowed',
        }}
      >
        {label}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className={`${base} hover:bg-white/55`}
      style={{ color: 'var(--ink-1)', borderColor: 'var(--line-1)' }}
    >
      {label}
    </Link>
  )
}
