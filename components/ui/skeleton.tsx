import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shimmering placeholder block. Honors the project's warm-canvas
 * palette (rgba on cream rather than gray) so it doesn't clash
 * with the liquid-glass surfaces.
 */
export function Skeleton({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('pm-skeleton', className)}
      style={style}
      {...props}
    >
      <span className="sr-only">Loading…</span>
    </div>
  )
}
