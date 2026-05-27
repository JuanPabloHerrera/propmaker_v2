import * as React from 'react'
import Link from 'next/link'
import { format, differenceInMinutes, isAfter, isSameDay } from 'date-fns'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/ui/pill'
import type { Meeting } from '@/types'
import { MEETING_TYPE_LABELS } from '@/types'

function whenLabel(scheduled: Date): string {
  const now = new Date()
  const mins = differenceInMinutes(scheduled, now)
  if (!isAfter(scheduled, now)) return 'now'
  if (mins < 60) return `in ${mins} min`
  if (isSameDay(scheduled, now)) return `today · ${format(scheduled, 'h:mm a')}`
  return format(scheduled, 'MMM d · h:mm a')
}

export function UpNextCard({ meeting }: { meeting: Meeting }) {
  const scheduled = meeting.scheduled_at ? new Date(meeting.scheduled_at) : null
  const attendeeNames = meeting.attendees?.map((a) => a.name).filter(Boolean) ?? []
  const attendeesText =
    attendeeNames.length > 0
      ? `with ${attendeeNames.slice(0, 2).join(' & ')}${attendeeNames.length > 2 ? ` +${attendeeNames.length - 2}` : ''}`
      : ''

  return (
    <div className="card p-5 mb-5 flex gap-4 items-center">
      <div
        className="grid place-items-center shrink-0"
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background:
            'linear-gradient(135deg, rgba(77,138,107,0.20), rgba(77,138,107,0.06))',
          border: '0.5px solid rgba(77,138,107,0.25)',
          color: 'var(--accent-base)',
        }}
      >
        <Icon name="mic" size={24} />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <Pill mono>
            UP NEXT{scheduled ? ` · ${whenLabel(scheduled)}` : ''}
          </Pill>
          <Pill mono>{MEETING_TYPE_LABELS[meeting.meeting_type].toUpperCase()}</Pill>
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--ink-1)',
          }}
        >
          {meeting.client_company ? `${meeting.client_company} · ` : ''}
          {meeting.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
          {scheduled ? format(scheduled, 'h:mm a') : 'Unscheduled'}
          {attendeesText && ` ${attendeesText}`}
        </div>
      </div>
      <div className="flex gap-2.5">
        <Link
          href={`/meetings/${meeting.id}/live`}
          className="inline-flex items-center gap-1.5 font-medium"
          style={{
            height: 28,
            padding: '0 11px',
            borderRadius: 7,
            fontSize: 12.5,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
        >
          Open brief
        </Link>
        <Link
          href={`/meetings/${meeting.id}/live`}
          className="inline-flex items-center gap-1.5 font-medium text-white"
          style={{
            height: 28,
            padding: '0 14px',
            borderRadius: 7,
            fontSize: 12.5,
            background:
              'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
            border: '0.5px solid rgba(77,138,107,0.6)',
            boxShadow:
              '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >
          Join with PropMaker
        </Link>
      </div>
    </div>
  )
}
