'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { AvatarInitials, colorForName } from '@/components/ui/avatar-initials'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
  elapsedSeconds: number
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  onEnd: () => void
  ending: boolean
  segmentCount: number
}

function fmt(seconds: number): string {
  if (seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function MeetingToolbar({
  meeting,
  elapsedSeconds,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onEnd,
  ending,
  segmentCount,
}: Props) {
  const router = useRouter()
  const isLive = meeting.status === 'active'
  const isCompleted = meeting.status === 'completed'

  return (
    <div
      className="flex items-center gap-2.5 shrink-0"
      style={{
        height: 48,
        padding: '0 14px',
        borderBottom: '0.5px solid var(--line-1)',
        background: 'rgba(255, 255, 255, 0.30)',
        backdropFilter: 'blur(30px) saturate(160%)',
        WebkitBackdropFilter: 'blur(30px) saturate(160%)',
      }}
    >
      <button
        type="button"
        onClick={() => router.push('/')}
        className="inline-flex items-center justify-center"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          color: 'var(--ink-2)',
        }}
        aria-label="Back"
      >
        <Icon name="chevL" size={14} />
      </button>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em' }}
          >
            {meeting.client_company ? `${meeting.client_company} · ` : ''}
            {meeting.title}
          </span>
          {isLive && (
            <span className="pill pill-rec shrink-0">
              <span className="dot dot-rec" />
              REC
            </span>
          )}
          {isCompleted && (
            <span className="pill pill-ok shrink-0">Completed</span>
          )}
        </div>
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 10.5, color: 'var(--ink-3)' }}
        >
          {meeting.meeting_url && (
            <>
              <span>{deriveProvider(meeting.meeting_url)}</span>
              <span>·</span>
            </>
          )}
          <span>
            {meeting.attendees?.length ?? 0} attendee
            {(meeting.attendees?.length ?? 0) === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span className="mono-num">{fmt(elapsedSeconds)}</span>
          <span>·</span>
          <span className="mono-num">{segmentCount} segments</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Two independent toggles — each button controls its own sidebar */}
      <div className="seg">
        <button
          type="button"
          className={leftOpen ? 'on' : ''}
          onClick={onToggleLeft}
          aria-pressed={leftOpen}
          aria-label="Toggle transcript panel"
          title="Transcript"
        >
          <Icon name="list" size={12} />
        </button>
        <button
          type="button"
          className={rightOpen ? 'on' : ''}
          onClick={onToggleRight}
          aria-pressed={rightOpen}
          aria-label="Toggle co-pilot panel"
          title="Co-pilot"
        >
          <Icon name="sparkle" size={12} />
        </button>
      </div>

      {meeting.attendees && meeting.attendees.length > 0 && (
        <div className="flex items-center -space-x-1.5">
          {meeting.attendees.slice(0, 3).map((a, i) => (
            <AvatarInitials
              key={i}
              initials={initialsOf(a.name)}
              color={(a.color as 'sage') || colorForName(a.name)}
              size={22}
            />
          ))}
        </div>
      )}

      {!isCompleted && (
        <button
          type="button"
          onClick={onEnd}
          disabled={ending}
          className="inline-flex items-center gap-1 font-medium"
          style={{
            height: 28,
            padding: '0 11px',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--rec)',
            background: 'rgba(217, 74, 74, 0.10)',
            border: '0.5px solid rgba(217, 74, 74, 0.25)',
          }}
        >
          {ending ? 'Ending…' : 'End meeting'}
        </button>
      )}
    </div>
  )
}

function deriveProvider(url: string): string {
  if (url.includes('zoom.us')) return 'Zoom'
  if (url.includes('meet.google')) return 'Google Meet'
  if (url.includes('teams.microsoft')) return 'Teams'
  return 'Call'
}
