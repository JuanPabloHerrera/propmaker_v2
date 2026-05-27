'use client'

import { useEffect, useRef } from 'react'
import type { TranscriptSegment } from '@/types'
import { format } from 'date-fns'
import { Pill } from '@/components/ui/pill'
import { Wave } from '@/components/ui/wave'
import { Icon } from '@/components/ui/icon'

interface Props {
  segments: TranscriptSegment[]
  interimText?: string
  isRecording?: boolean
  elapsedSeconds?: number
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function TranscriptPanel({
  segments,
  interimText,
  isRecording = false,
  elapsedSeconds = 0,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments.length, interimText])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-2 shrink-0"
        style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--line-1)' }}
      >
        <div className="text-[12px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          Live transcript
        </div>
        <Pill mono>ES-MX</Pill>
        <span className="flex-1" />
        {isRecording && (
          <span className="flex items-center gap-1.5">
            <span className="dot dot-rec" />
            <span
              className="mono-num"
              style={{ fontSize: 10.5, color: 'var(--rec)' }}
            >
              REC {fmtTime(elapsedSeconds)}
            </span>
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto" style={{ padding: '4px 14px 12px' }}>
        {segments.length === 0 && !interimText ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              Waiting for audio…
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>
              Start the mic from the toolbar above.
            </div>
          </div>
        ) : (
          <>
            {segments.map((seg) => (
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
            ))}
            {interimText && (
              <div className="tx-line opacity-70">
                <div className="tx-meta mono-num">
                  …
                  <div style={{ marginTop: 2 }}>
                    <Wave count={8} max={8} />
                  </div>
                </div>
                <div className="tx-body flex-1 italic">{interimText}</div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div
        className="flex gap-1.5 shrink-0"
        style={{ padding: 10, borderTop: '0.5px solid var(--line-1)' }}
      >
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
          onClick={() => {
            const text = segments
              .map((s) => `[${s.start_time != null ? fmtTime(s.start_time) : ''}] ${s.speaker ?? 'Speaker'}: ${s.text}`)
              .join('\n')
            navigator.clipboard.writeText(text).catch(() => {})
          }}
        >
          <Icon name="copy" size={12} />
          Copy
        </button>
      </div>
    </div>
  )
}
