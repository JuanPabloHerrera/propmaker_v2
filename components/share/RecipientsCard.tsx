'use client'

import * as React from 'react'
import { AvatarInitials, colorForName } from '@/components/ui/avatar-initials'
import { Pill } from '@/components/ui/pill'
import type { MeetingAttendee } from '@/types'

interface Props {
  attendees: MeetingAttendee[]
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function RecipientsCard({ attendees }: Props) {
  return (
    <div className="card p-[18px]">
      <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--ink-1)' }}>
        Recipients
      </div>
      {attendees.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          No attendees on this meeting. Add them on the meeting setup to share with one click.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {attendees.map((a, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <AvatarInitials
                initials={initialsOf(a.name)}
                color={(a.color as 'sage') || colorForName(a.name)}
                size={28}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink-1)' }}>
                  {a.name}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                  {a.email || '—'}
                </div>
              </div>
              <Pill mono>SIGNER</Pill>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
