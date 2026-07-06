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

const SOURCE_LABEL: Record<ReferenceProposal['source'], string> = {
  app_proposal: 'FROM APP',
  pptx_template: 'TEMPLATE',
  uploaded: 'UPLOADED',
}

export function ReferenceCard({ reference, onDelete, deleting }: Props) {
  const isTemplate = reference.source === 'pptx_template'
  const theme = reference.theme_json
  const swatches = theme
    ? [theme.background?.color, theme.accent, theme.accent2, theme.ink].filter(Boolean)
    : []

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink-1)' }}>
            {reference.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Pill mono>{SOURCE_LABEL[reference.source]}</Pill>
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

      {isTemplate ? (
        <div className="flex flex-col gap-2">
          <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            Style template — pick it when exporting to PowerPoint to match this deck&apos;s look.
          </div>
          {swatches.length > 0 && (
            <div className="flex items-center gap-1.5">
              {swatches.map((c, i) => (
                <span
                  key={i}
                  title={`#${c}`}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: `#${c}`,
                    border: '0.5px solid rgba(28,24,20,0.15)',
                  }}
                />
              ))}
              {theme?.majorFont && (
                <span className="text-[10.5px] ml-1" style={{ color: 'var(--ink-3)' }}>
                  {theme.majorFont}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  )
}
