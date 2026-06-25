'use client'

import * as React from 'react'
import { Icon } from '@/components/ui/icon'
import type { CaptureMode } from '@/types'

interface Props {
  value: CaptureMode
  onChange: (next: CaptureMode) => void
  meetingUrl: string
  onMeetingUrlChange: (v: string) => void
  urlError?: string | null
  urlInputRef?: React.Ref<HTMLInputElement>
}

export function CaptureMethodTiles({
  value,
  onChange,
  meetingUrl,
  onMeetingUrlChange,
  urlError,
  urlInputRef,
}: Props) {
  // Two capture modes:
  //   Conferencing → 'both'  = Recall.ai bot joins the call + local mic.
  //   Local mic    → 'browser' = this Mac's microphone only.
  // Legacy 'recall' rows render as conferencing.
  const isConferencing = value === 'both' || value === 'recall'
  const isBrowser = value === 'browser'

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Tile
        active={isConferencing}
        onClick={() => onChange('both')}
        title="Conferencing"
        description="A bot joins Zoom / Meet / Teams and your mic is captured too."
      >
        {isConferencing && (
          <div className="mt-2">
            <div
              className="flex items-center gap-1.5 mono-num"
              style={{
                borderBottom: `0.5px solid ${urlError ? 'var(--rec)' : 'transparent'}`,
              }}
            >
              <Icon name="link" size={12} />
              <input
                ref={urlInputRef}
                type="url"
                value={meetingUrl}
                onChange={(e) => onMeetingUrlChange(e.target.value)}
                placeholder="zoom.us/j/123…"
                className="bg-transparent outline-none flex-1"
                style={{ fontSize: 11, color: 'var(--ink-3)' }}
                onClick={(e) => e.stopPropagation()}
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? 'meeting-url-error' : undefined}
              />
            </div>
            {urlError && (
              <p
                id="meeting-url-error"
                role="alert"
                className="mt-1"
                style={{ fontSize: 10.5, color: 'var(--rec)' }}
              >
                {urlError}
              </p>
            )}
          </div>
        )}
      </Tile>
      <Tile
        active={isBrowser}
        onClick={() => onChange('browser')}
        title="Local mic"
        description="This Mac's microphone only. For in-person meetings."
      >
        {isBrowser && (
          <div className="flex items-center gap-1.5 mt-2" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="dot" style={{ background: 'var(--ink-4)' }} />
            Default microphone
          </div>
        )}
      </Tile>
    </div>
  )
}

interface TileProps {
  active: boolean
  onClick: () => void
  title: string
  description: string
  children?: React.ReactNode
}

function Tile({ active, onClick, title, description, children }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex gap-2.5 items-start text-left transition-colors"
      style={{
        padding: 14,
        borderRadius: 10,
        border: active ? '0.5px solid var(--accent-base)' : '0.5px solid var(--line-1)',
        background: active ? 'var(--accent-soft)' : 'rgba(255,255,255,0.4)',
      }}
      aria-pressed={active}
    >
      <div className={`cbox ${active ? 'on' : ''}`}>
        {active && <Icon name="check" size={10} strokeWidth={1.6} />}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          {title}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--ink-2)', marginTop: 2 }}>
          {description}
        </div>
        {children}
      </div>
    </button>
  )
}
