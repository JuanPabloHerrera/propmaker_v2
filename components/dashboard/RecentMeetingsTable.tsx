import * as React from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Icon } from '@/components/ui/icon'
import { MeetingStatusMenu } from './MeetingStatusMenu'
import type { Meeting } from '@/types'

interface Props {
  meetings: Meeting[]
}

export function RecentMeetingsTable({ meetings }: Props) {
  if (meetings.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center text-center">
        <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink-1)' }}>
          No meetings yet
        </div>
        <div className="text-[12px] mb-4" style={{ color: 'var(--ink-3)' }}>
          Start your first meeting — PropMaker will join, transcribe, and draft the proposal.
        </div>
        <Link
          href="/meetings/new"
          className="inline-flex items-center gap-1.5 text-white font-medium"
          style={{
            height: 32,
            padding: '0 14px',
            borderRadius: 8,
            fontSize: 12.5,
            background:
              'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
            boxShadow: '0 1px 3px var(--accent-glow)',
          }}
        >
          <Icon name="mic" />
          Start a meeting
        </Link>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: '1.5fr 2fr 1.2fr 1fr 30px',
          padding: '10px 18px',
          fontSize: 10.5,
          color: 'var(--ink-3)',
          borderBottom: '0.5px solid var(--line-1)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono), monospace',
        }}
      >
        <div>Client</div>
        <div>Meeting</div>
        <div>When</div>
        <div>Status</div>
        <div />
      </div>
      {meetings.map((m, i) => {
        const href =
          m.status === 'completed'
            ? `/meetings/${m.id}/proposal`
            : `/meetings/${m.id}/live`
        const attendees = m.attendees?.map((a) => a.name).filter(Boolean).join(', ') ?? ''
        const when = m.scheduled_at
          ? format(new Date(m.scheduled_at), "MMM d · h:mm a")
          : format(new Date(m.created_at), 'MMM d')
        const isOverdueUpcoming =
          m.deal_status === 'upcoming' &&
          m.scheduled_at != null &&
          new Date(m.scheduled_at).getTime() < Date.now()
        return (
          <Link
            key={m.id}
            href={href}
            className="grid items-center hover:bg-[rgba(28,24,20,0.025)] transition-colors"
            style={{
              gridTemplateColumns: '1.5fr 2fr 1.2fr 1fr 30px',
              padding: '12px 18px',
              borderBottom:
                i < meetings.length - 1 ? '0.5px solid var(--line-1)' : 'none',
              background:
                m.deal_status === 'upcoming' ? 'rgba(77,138,107,0.04)' : 'transparent',
            }}
          >
            <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink-1)' }}>
              {m.client_company || '—'}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] truncate" style={{ color: 'var(--ink-2)' }}>
                {m.title}
              </div>
              {attendees && (
                <div
                  className="text-[11px] truncate"
                  style={{ color: 'var(--ink-3)', marginTop: 2 }}
                >
                  {attendees}
                </div>
              )}
            </div>
            <div className="text-[12px] flex flex-col" style={{ color: 'var(--ink-2)' }}>
              <span>{when}</span>
              {isOverdueUpcoming && (
                <span
                  className="text-[10.5px] uppercase tracking-wider font-mono"
                  style={{ color: 'var(--warn)' }}
                  aria-label="Scheduled time has passed"
                >
                  Overdue
                </span>
              )}
            </div>
            <div>
              <MeetingStatusMenu
                meetingId={m.id}
                status={m.deal_status}
                value={m.client_value}
              />
            </div>
            <span style={{ color: 'var(--ink-3)' }}>
              <Icon name="chevR" size={12} />
            </span>
          </Link>
        )
      })}
    </div>
  )
}
