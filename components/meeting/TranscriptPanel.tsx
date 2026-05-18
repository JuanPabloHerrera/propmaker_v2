'use client'

import { useEffect, useRef } from 'react'
import type { TranscriptSegment } from '@/types'
import { format } from 'date-fns'

export function TranscriptPanel({ segments, interimText }: { segments: TranscriptSegment[]; interimText?: string }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments.length])

  if (segments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8">
        <div>
          <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-xl mx-auto mb-3">🎙️</div>
          <p className="text-sm text-[#6e6e73]">Waiting for transcript…</p>
          <p className="text-xs text-[#6e6e73] mt-1">The bot is joining the meeting.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {segments.map((seg) => (
        <div key={seg.id} className="group">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-semibold text-[#1d1d1f]">{seg.speaker ?? 'Speaker'}</span>
            <span className="text-xs text-[#6e6e73]">
              {seg.start_time != null
                ? formatDuration(seg.start_time)
                : format(new Date(seg.created_at), 'HH:mm')}
            </span>
          </div>
          <p className="text-sm text-[#1d1d1f] leading-relaxed">{seg.text}</p>
        </div>
      ))}
      {interimText && (
        <div className="group opacity-60">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-semibold text-[#1d1d1f]">…</span>
          </div>
          <p className="text-sm text-[#1d1d1f] leading-relaxed italic whitespace-pre-wrap break-words">{interimText}</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
