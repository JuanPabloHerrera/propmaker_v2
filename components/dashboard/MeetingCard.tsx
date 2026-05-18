import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Meeting, MeetingStatus } from '@/types'
import { MEETING_TYPE_LABELS } from '@/types'
import { format } from 'date-fns'

const STATUS_CONFIG: Record<MeetingStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-[#f5f5f7] text-[#6e6e73] border-[#d2d2d7]' },
  active: { label: 'Live', className: 'bg-red-50 text-red-600 border-red-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: 'Failed', className: 'bg-orange-50 text-orange-700 border-orange-200' },
}

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const status = STATUS_CONFIG[meeting.status]
  const href = meeting.status === 'completed'
    ? `/meetings/${meeting.id}/proposal`
    : meeting.status === 'active'
    ? `/meetings/${meeting.id}/live`
    : `/meetings/${meeting.id}/live`

  return (
    <Link href={href}>
      <div className="bg-white border border-[#d2d2d7] rounded-2xl px-5 py-4 hover:border-[#6e6e73] hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              {meeting.status === 'active' && (
                <span className="w-2 h-2 rounded-full bg-red-500 live-pulse shrink-0" />
              )}
              <h3 className="text-sm font-semibold text-[#1d1d1f] truncate">{meeting.title}</h3>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-[#6e6e73]">
                {MEETING_TYPE_LABELS[meeting.meeting_type]}
              </span>
              <span className="text-xs text-[#d2d2d7]">·</span>
              <span className="text-xs text-[#6e6e73]">
                {format(new Date(meeting.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs font-medium shrink-0 ml-4 ${status.className}`}
          >
            {status.label}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
