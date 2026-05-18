import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { MeetingCard } from '@/components/dashboard/MeetingCard'
import type { Meeting } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">Meetings</h2>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            {meetings?.length ?? 0} meeting{meetings?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/meetings/new" className={buttonVariants({ className: 'rounded-xl! bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white h-9 px-4 text-sm font-medium' })}>
          New meeting
        </Link>
      </div>

      {!meetings || meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-2xl mb-4">
            🎙️
          </div>
          <h3 className="text-base font-semibold text-[#1d1d1f]">No meetings yet</h3>
          <p className="text-sm text-[#6e6e73] mt-1 max-w-xs">
            Create your first meeting and PropCopilot will join, transcribe, and help you write the proposal.
          </p>
          <Link href="/meetings/new" className={buttonVariants({ className: 'mt-6 rounded-xl! bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white h-9 px-4 text-sm font-medium' })}>
            Get started
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting: Meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  )
}
