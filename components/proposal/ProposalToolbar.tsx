'use client'

import * as React from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { Segmented } from '@/components/ui/segmented'
import type { Proposal } from '@/types'

type EditMode = 'edit' | 'preview'

interface Props {
  meetingId: string
  title: string
  proposal: Proposal | null
  mode: EditMode
  onModeChange: (m: EditMode) => void
  onPrint: () => void
  onRefine?: () => void
}

export function ProposalToolbar({
  meetingId,
  title,
  proposal,
  mode,
  onModeChange,
  onPrint,
  onRefine,
}: Props) {
  return (
    <div
      className="flex items-center gap-2.5 shrink-0 pm-no-print"
      style={{
        height: 46,
        padding: '0 16px 0 18px',
        borderBottom: '0.5px solid var(--line-1)',
        background: 'rgba(255, 255, 255, 0.30)',
        backdropFilter: 'blur(30px) saturate(160%)',
        WebkitBackdropFilter: 'blur(30px) saturate(160%)',
      }}
    >
      <div className="flex flex-col min-w-0">
        <div
          className="truncate"
          style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}
        >
          {title} · Proposal
        </div>
        <div className="mono-num" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          {proposal ? `PROP-${proposal.id.slice(0, 8).toUpperCase()}` : 'No proposal yet'}
          {proposal && ` · ${proposal.status === 'final' ? 'FINAL' : 'DRAFT'}`}
        </div>
      </div>

      <div className="flex-1" />

      <Segmented<EditMode>
        items={[
          { value: 'edit', label: 'Edit' },
          { value: 'preview', label: 'Preview' },
        ]}
        value={mode}
        onChange={onModeChange}
      />

      {onRefine && (
        <button
          type="button"
          onClick={onRefine}
          className="inline-flex items-center gap-1.5 font-medium"
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
        >
          <Icon name="sparkle" size={12} />
          Refine
        </button>
      )}

      <button
        type="button"
        onClick={onPrint}
        className="inline-flex items-center gap-1.5 font-medium"
        style={{
          height: 24,
          padding: '0 9px',
          borderRadius: 6,
          fontSize: 11.5,
          color: 'var(--ink-1)',
          background: 'rgba(255,255,255,0.6)',
          border: '0.5px solid rgba(28,24,20,0.10)',
        }}
      >
        <Icon name="download" size={12} />
        PDF
      </button>

      <Link
        href={`/meetings/${meetingId}/proposal/share`}
        className="inline-flex items-center gap-1.5 font-medium text-white"
        style={{
          height: 24,
          padding: '0 11px',
          borderRadius: 6,
          fontSize: 11.5,
          background:
            'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
          border: '0.5px solid rgba(77,138,107,0.6)',
        }}
      >
        <Icon name="share" size={12} />
        Share
      </Link>
    </div>
  )
}
