import * as React from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: boolean
  as?: 'div' | 'section' | 'article'
}

export function GlassCard({
  accent,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: GlassCardProps) {
  return (
    <Tag className={cn('card', accent && 'card-accent', className)} {...rest}>
      {children}
    </Tag>
  )
}
