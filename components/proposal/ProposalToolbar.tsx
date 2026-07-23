'use client'

import * as React from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { DOC_TYPE_LABELS, type MeetingDocument } from '@/types'

interface Props {
  meetingId: string
  title: string
  proposal: MeetingDocument | null
  onViewTranscript?: () => void
  onToggleStatus: () => void
  statusBusy?: boolean
}

export function ProposalToolbar({
  meetingId,
  title,
  proposal,
  onViewTranscript,
  onToggleStatus,
  statusBusy,
}: Props) {
  const isFinal = proposal?.status === 'final'
  const typeLabel = proposal ? DOC_TYPE_LABELS[proposal.doc_type] : 'Document'
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
          {title} · {typeLabel}
        </div>
        <div className="mono-num" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          {proposal ? `DOC-${proposal.id.slice(0, 8).toUpperCase()}` : 'No document yet'}
          {proposal && ` · ${proposal.status === 'final' ? 'FINAL' : 'DRAFT'}`}
        </div>
      </div>

      <div className="flex-1" />

      {onViewTranscript && (
        <button
          type="button"
          onClick={onViewTranscript}
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
          <Icon name="doc" size={12} />
          Transcript
        </button>
      )}

      {proposal && (
        <button
          type="button"
          onClick={onToggleStatus}
          disabled={statusBusy}
          className="inline-flex items-center gap-1.5 font-medium"
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: 6,
            fontSize: 11.5,
            color: isFinal ? 'var(--ink-1)' : 'var(--ok)',
            background: isFinal
              ? 'rgba(255,255,255,0.6)'
              : 'rgba(77,138,107,0.10)',
            border: isFinal
              ? '0.5px solid rgba(28,24,20,0.10)'
              : '0.5px solid rgba(77,138,107,0.25)',
            opacity: statusBusy ? 0.5 : 1,
          }}
        >
          <Icon name="check" size={12} strokeWidth={1.8} />
          {statusBusy
            ? 'Saving…'
            : isFinal
              ? 'Reopen as draft'
              : 'Mark as final'}
        </button>
      )}

      <Link
        href={proposal ? `/meetings/${meetingId}/documents/${proposal.id}/share` : `/meetings/${meetingId}/documents`}
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
        <Icon name="download" size={12} />
        Export
      </Link>
    </div>
  )
}
