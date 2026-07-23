'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/icon'
import type { TranscriptSegment } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  meetingId: string
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function TranscriptDrawer({ open, onClose, meetingId }: Props) {
  const supabase = React.useMemo(() => createClient(), [])
  const [loading, setLoading] = React.useState(false)
  const [segments, setSegments] = React.useState<TranscriptSegment[]>([])
  const [copied, setCopied] = React.useState(false)
  const previouslyFocused = React.useRef<HTMLElement | null>(null)

  // Fetch the transcript each time the drawer opens. Recall segments take
  // priority; fall back to the browser-captured transcript when the bot path
  // wasn't used (mirrors the source partitioning in lib/meeting-inputs.ts).
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('transcript_segments')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at')
      .then(({ data }) => {
        if (cancelled) return
        const all = (data ?? []) as TranscriptSegment[]
        const recall = all.filter((s) => s.source === 'recall')
        setSegments(recall.length ? recall : all)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, meetingId, supabase])

  // Focus management: capture caller, restore on close.
  React.useEffect(() => {
    if (open) {
      previouslyFocused.current =
        (document.activeElement as HTMLElement | null) ?? null
    } else {
      previouslyFocused.current?.focus?.()
      setCopied(false)
    }
  }, [open])

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function copyTranscript() {
    const text = segments
      .map(
        (s) =>
          `[${s.start_time != null ? fmtTime(s.start_time) : ''}] ${s.speaker ?? 'Speaker'}: ${s.text}`,
      )
      .join('\n')
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Meeting transcript"
      className="fixed inset-0 z-40 pm-no-print"
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close transcript drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/20 transition-opacity"
      />

      {/* Drawer */}
      <div
        className="absolute right-0 top-0 bottom-0 flex flex-col glass-strong"
        style={{
          // `position` must stay inline: `.glass-strong` declares position:relative
          // as unlayered CSS, which outranks Tailwind's layered `absolute` utility
          // and would drop this panel back into normal flow.
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(440px, 92vw)',
          borderRadius: 0,
          borderLeft: '0.5px solid var(--line-1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '14px 18px',
            borderBottom: '0.5px solid var(--line-1)',
            background: 'rgba(255, 252, 245, 0.55)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--accent-base)' }}>
              <Icon name="doc" size={14} />
            </span>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
              Transcript
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transcript drawer"
            className="grid place-items-center rounded-md hover:bg-[rgba(28,24,20,0.04)]"
            style={{ width: 28, height: 28, color: 'var(--ink-2)' }}
          >
            <Icon name="close" size={12} strokeWidth={1.6} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '4px 14px 12px' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Loading transcript…
              </div>
            </div>
          ) : segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                No transcript was captured for this meeting.
              </div>
            </div>
          ) : (
            segments.map((seg) => (
              <div key={seg.id} className="tx-line">
                <div className="tx-meta mono-num">
                  {seg.start_time != null
                    ? fmtTime(seg.start_time)
                    : format(new Date(seg.created_at), 'HH:mm')}
                  <div style={{ marginTop: 2 }}>
                    <span className="tx-spk">{seg.speaker ?? 'Speaker'}</span>
                  </div>
                </div>
                <div className="tx-body flex-1">{seg.text}</div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-1.5 shrink-0"
          style={{ padding: 10, borderTop: '0.5px solid var(--line-1)' }}
        >
          <button
            type="button"
            disabled={segments.length === 0}
            className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium disabled:opacity-50"
            style={{
              height: 24,
              padding: '0 9px',
              borderRadius: 6,
              fontSize: 11.5,
              color: 'var(--ink-1)',
              background: 'rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(28,24,20,0.10)',
            }}
            onClick={copyTranscript}
          >
            <Icon name="copy" size={12} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
