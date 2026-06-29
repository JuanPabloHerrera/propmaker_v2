'use client'

import { format } from 'date-fns'
import { Pill } from '@/components/ui/pill'
import { Icon } from '@/components/ui/icon'
import type { ReferenceProposal } from '@/types'

interface Props {
  reference: ReferenceProposal
  onDelete: (id: string) => void
  deleting: boolean
}

export function ReferenceCard({ reference, onDelete, deleting }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink-1)' }}>
            {reference.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Pill mono>{reference.source === 'app_proposal' ? 'FROM APP' : 'UPLOADED'}</Pill>
            {reference.category && <Pill>{reference.category}</Pill>}
            <span className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
              {format(new Date(reference.created_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(reference.id)}
          disabled={deleting}
          aria-label="Delete reference"
          className="inline-flex items-center justify-center shrink-0 disabled:opacity-50"
          style={{ width: 26, height: 26, borderRadius: 6, color: 'var(--ink-3)' }}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
      <p
        className="text-[12px] whitespace-pre-wrap"
        style={{
          color: 'var(--ink-2)',
          display: '-webkit-box',
          WebkitLineClamp: 5,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {reference.summary}
      </p>
    </div>
  )
}
