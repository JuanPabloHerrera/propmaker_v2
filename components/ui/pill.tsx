import * as React from 'react'
import { cn } from '@/lib/utils'

type PillVariant = 'default' | 'accent' | 'mono' | 'ok' | 'warn' | 'rec'

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant
  mono?: boolean
}

const VARIANT_CLASS: Record<PillVariant, string> = {
  default: '',
  accent: 'pill-accent',
  mono: 'pill-mono',
  ok: 'pill-ok',
  warn: 'pill-warn',
  rec: 'pill-rec',
}

export function Pill({ variant = 'default', mono, className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn('pill', VARIANT_CLASS[variant], mono && 'pill-mono', className)}
      {...rest}
    >
      {children}
    </span>
  )
}
