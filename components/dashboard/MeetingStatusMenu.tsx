'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@/components/ui/icon'
import { DEAL_STATUS_LABELS, type DealStatus } from '@/types'

// 'upcoming' is legacy-only (scheduling was removed): still styled for old rows
// but no longer selectable.
const ALL_STATUSES: DealStatus[] = ['draft', 'proposal_sent', 'won', 'lost']

interface Props {
  meetingId: string
  status: DealStatus
}

type StatusStyle = {
  bg: string
  color: string
  border: string
  showDot: boolean
}

const STATUS_STYLES: Record<DealStatus, StatusStyle> = {
  draft: {
    bg: 'rgba(255, 252, 246, 0.55)',
    color: 'var(--ink-2)',
    border: 'var(--line-1)',
    showDot: false,
  },
  upcoming: {
    bg: 'rgba(77, 138, 107, 0.16)',
    color: 'var(--accent-strong)',
    border: 'rgba(77, 138, 107, 0.28)',
    showDot: true,
  },
  proposal_sent: {
    bg: 'rgba(201, 138, 58, 0.16)',
    color: 'var(--warn-strong)',
    border: 'rgba(201, 138, 58, 0.28)',
    showDot: false,
  },
  won: {
    bg: 'rgba(77, 138, 107, 0.16)',
    color: 'var(--accent-strong)',
    border: 'rgba(77, 138, 107, 0.28)',
    showDot: false,
  },
  lost: {
    bg: 'rgba(176, 52, 52, 0.14)',
    color: 'var(--rec)',
    border: 'rgba(176, 52, 52, 0.26)',
    showDot: false,
  },
}

export function MeetingStatusMenu({ meetingId, status }: Props) {
  const router = useRouter()
  const [optimistic, setOptimistic] = React.useState<DealStatus>(status)
  const [, startTransition] = React.useTransition()

  React.useEffect(() => {
    setOptimistic(status)
  }, [status])

  const handleSelect = async (next: string) => {
    const nextStatus = next as DealStatus
    if (nextStatus === optimistic) return
    const prev = optimistic
    setOptimistic(nextStatus)
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_status: nextStatus }),
      })
      if (!res.ok) throw new Error(await res.text())
      startTransition(() => router.refresh())
    } catch (err) {
      setOptimistic(prev)
      toast.error('Could not update status')
      console.error(err)
    }
  }

  const style = STATUS_STYLES[optimistic]
  const label = DEAL_STATUS_LABELS[optimistic]

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className="inline-block"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<span />}
          nativeButton={false}
          aria-label="Change deal status"
          className="group/status-trigger inline-flex items-center gap-1.5 cursor-pointer select-none transition-all duration-150 hover:brightness-[1.04] active:scale-[0.98] data-[popup-open]:brightness-[1.04] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-base)]"
          style={{
            height: 22,
            padding: '0 6px 0 8px',
            borderRadius: 999,
            background: style.bg,
            backdropFilter: 'blur(28px) saturate(170%)',
            WebkitBackdropFilter: 'blur(28px) saturate(170%)',
            border: `0.5px solid ${style.border}`,
            boxShadow:
              '0 1px 2px rgba(28, 22, 14, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -0.5px 0 rgba(28, 24, 20, 0.04)',
            color: style.color,
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          {style.showDot && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: style.color,
                flexShrink: 0,
              }}
            />
          )}
          <span>{label}</span>
          <span
            className="transition-transform duration-150 group-data-[popup-open]/status-trigger:rotate-180"
            style={{ opacity: 0.7, marginLeft: 1 }}
          >
            <Icon name="chevD" size={10} />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6}>
          <DropdownMenuRadioGroup
            value={optimistic}
            onValueChange={handleSelect}
          >
            {ALL_STATUSES.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: STATUS_STYLES[s].color,
                    display: 'inline-block',
                    marginRight: 6,
                  }}
                />
                {DEAL_STATUS_LABELS[s]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
