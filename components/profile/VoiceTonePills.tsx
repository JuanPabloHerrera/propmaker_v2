'use client'

import * as React from 'react'
import { VOICE_TONES, type VoiceTone } from '@/types'
import { cn } from '@/lib/utils'

interface VoiceTonePillsProps {
  value: string[]
  onChange: (next: string[]) => void
}

export function VoiceTonePills({ value, onChange }: VoiceTonePillsProps) {
  function toggle(tone: VoiceTone) {
    if (value.includes(tone)) onChange(value.filter((v) => v !== tone))
    else onChange([...value, tone])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {VOICE_TONES.map((t) => {
        const on = value.includes(t)
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={cn('pill cursor-pointer transition-colors', on && 'pill-accent')}
            style={{ height: 26, fontSize: 11.5, padding: '0 12px' }}
            aria-pressed={on}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}
