import * as React from 'react'
import { cn } from '@/lib/utils'

interface WaveProps extends React.HTMLAttributes<HTMLSpanElement> {
  count?: number
  max?: number
  color?: string
}

// Deterministic sine-shape waveform (no animation by default — match the
// design's static viz, which reads as "audio present" rather than chasing
// real audio levels).
export function Wave({ count = 14, max = 12, color, className, ...rest }: WaveProps) {
  const bars = []
  for (let i = 0; i < count; i++) {
    const v = (Math.sin(i * 0.55) + 1) / 2 * 0.7 + 0.3
    const h = 3 + v * max
    bars.push(
      <i
        key={i}
        style={{
          height: h,
          background: color || 'var(--accent-base)',
        }}
      />,
    )
  }
  return (
    <span className={cn('wave', className)} {...rest}>
      {bars}
    </span>
  )
}
