import * as React from 'react'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { Pill } from '@/components/ui/pill'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
  questionIndex: number
  totalQuestions: number
  onSkip: () => void
  disabled?: boolean
  busy?: boolean
}

export function QAToolbar({ meeting, questionIndex, totalQuestions, onSkip, disabled, busy }: Props) {
  return (
    <>
      <div
        className="flex items-center gap-3 shrink-0"
        style={{
          height: 48,
          padding: '0 18px',
          borderBottom: '0.5px solid var(--line-1)',
          background: 'rgba(255, 255, 255, 0.30)',
          backdropFilter: 'blur(30px) saturate(160%)',
          WebkitBackdropFilter: 'blur(30px) saturate(160%)',
        }}
      >
        <AvatarInitials initials="P" color="bot" size={24} />
        <div className="flex flex-col">
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>
            Agent · Refining your draft
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
            {meeting.client_company ? `${meeting.client_company} · ` : ''}
            {meeting.title}
          </div>
        </div>
        <div className="flex-1" />
        <Pill mono>
          QUESTION {questionIndex} OF {totalQuestions}
        </Pill>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          className="font-medium disabled:opacity-50"
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'var(--ink-2)',
            background: 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Generating…' : 'Skip questions'}
        </button>
      </div>

      <div style={{ padding: '14px 22% 0' }}>
        <div className="flex gap-1.5">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background:
                  i < questionIndex
                    ? 'linear-gradient(90deg, var(--accent-2), var(--accent-base))'
                    : 'rgba(28, 24, 20, 0.08)',
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
