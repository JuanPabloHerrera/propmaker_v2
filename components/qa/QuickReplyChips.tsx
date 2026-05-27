'use client'

import * as React from 'react'

interface Props {
  replies: string[]
  onPick: (value: string) => void
}

export function QuickReplyChips({ replies, onPick }: Props) {
  if (replies.length === 0) return null
  return (
    <div className="flex gap-1.5 flex-wrap">
      {replies.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onPick(r)}
          className="pill cursor-pointer hover:bg-white/80 transition-colors"
          style={{ fontSize: 11, padding: '0 11px', height: 24 }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
