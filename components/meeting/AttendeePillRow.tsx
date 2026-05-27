'use client'

import * as React from 'react'
import { AvatarInitials, colorForName } from '@/components/ui/avatar-initials'
import { Icon } from '@/components/ui/icon'
import type { MeetingAttendee } from '@/types'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '??'
}

interface AttendeePillRowProps {
  value: MeetingAttendee[]
  onChange: (next: MeetingAttendee[]) => void
}

export function AttendeePillRow({ value, onChange }: AttendeePillRowProps) {
  const [draft, setDraft] = React.useState('')

  function add() {
    const trimmed = draft.trim()
    if (!trimmed) return
    // Accept "Name <email>" or just "Name" or just "email@x.y"
    const m = trimmed.match(/^(.+?)\s*[<(]\s*([^>)]+)\s*[>)]\s*$/)
    let name = trimmed
    let email: string | undefined
    if (m) {
      name = m[1].trim()
      email = m[2].trim()
    } else if (/^\S+@\S+\.\S+$/.test(trimmed)) {
      email = trimmed
      name = trimmed.split('@')[0]
    }
    onChange([...value, { name, email, color: colorForName(name) }])
    setDraft('')
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value.length - 1)
    }
  }

  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {value.map((a, i) => (
        <div
          key={i}
          className="glass-soft flex items-center gap-2"
          style={{ padding: '4px 6px 4px 4px', borderRadius: 999 }}
        >
          <AvatarInitials initials={initialsOf(a.name)} color={(a.color as 'sage') || 'sage'} size={20} />
          <span style={{ fontSize: 12, color: 'var(--ink-1)' }}>{a.name}</span>
          <button
            type="button"
            onClick={() => remove(i)}
            className="inline-flex items-center justify-center hover:bg-[rgba(28,24,20,0.08)] transition-colors"
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              color: 'var(--ink-3)',
              background: 'rgba(28,24,20,0.04)',
            }}
            aria-label={`Remove ${a.name}`}
          >
            <Icon name="close" size={9} strokeWidth={1.6} />
          </button>
        </div>
      ))}
      <div
        className="flex items-center gap-1.5"
        style={{
          padding: '4px 10px',
          borderRadius: 999,
          border: '0.5px dashed var(--line-1)',
          fontSize: 12,
          color: 'var(--ink-3)',
        }}
      >
        <Icon name="plus" size={12} />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add()}
          placeholder="Add attendee"
          className="bg-transparent outline-none"
          style={{ fontSize: 12, color: 'var(--ink-1)', width: 130 }}
        />
      </div>
    </div>
  )
}
