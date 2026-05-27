import * as React from 'react'
import { cn } from '@/lib/utils'

const GRADIENTS: Record<string, string> = {
  sage: 'linear-gradient(135deg, #9bc4a8, #5d8a73)',
  amber: 'linear-gradient(135deg, #f0c280, #c97e54)',
  steel: 'linear-gradient(135deg, #88a6d4, #5471a8)',
  rose: 'linear-gradient(135deg, #d49ebf, #a5598c)',
  bot: 'linear-gradient(135deg, #a3d4b8, #4d8a6b)',
}

export type AvatarColor = keyof typeof GRADIENTS

interface AvatarInitialsProps extends React.HTMLAttributes<HTMLDivElement> {
  initials: string
  color?: AvatarColor
  size?: number
  ring?: boolean
}

// Deterministic color from a string (name) so the same person always gets
// the same gradient across the app.
export function colorForName(name: string): AvatarColor {
  const keys = Object.keys(GRADIENTS) as AvatarColor[]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return keys[Math.abs(hash) % keys.length]
}

export function AvatarInitials({
  initials,
  color = 'sage',
  size = 24,
  ring = false,
  className,
  style,
  ...rest
}: AvatarInitialsProps) {
  return (
    <div
      className={cn(
        'inline-grid place-items-center rounded-full text-white font-semibold shrink-0',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: GRADIENTS[color],
        fontSize: Math.max(9, size * 0.42),
        boxShadow: ring
          ? '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 3px var(--accent-base), 0 1px 2px rgba(0,0,0,0.1)'
          : '0 1px 2px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.30)',
        ...style,
      }}
      {...rest}
    >
      {initials}
    </div>
  )
}
