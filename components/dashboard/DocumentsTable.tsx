import * as React from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Icon, type IconName } from '@/components/ui/icon'
import { DOC_TYPE_LABELS, type DocType } from '@/types'

export interface DocumentRow {
  id: string
  meeting_id: string
  doc_type: DocType
  title: string | null
  created_at: string
  meetingTitle: string | null
  clientCompany: string | null
}

const DOC_TYPE_ICONS: Record<DocType, IconName> = {
  minute: 'list',
  summary: 'doc',
  proposal: 'pen',
  notes: 'sparkle',
}

interface Props {
  documents: DocumentRow[]
}

export function DocumentsTable({ documents }: Props) {
  if (documents.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center text-center">
        <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink-1)' }}>
          No documents yet
        </div>
        <div className="text-[12px] mb-4" style={{ color: 'var(--ink-3)' }}>
          Every meeting minute, summary, proposal, and notes document you generate shows up here.
        </div>
        <Link
          href="/meetings/new"
          className="inline-flex items-center gap-1.5 text-white font-medium"
          style={{
            height: 32,
            padding: '0 14px',
            borderRadius: 8,
            fontSize: 12.5,
            background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
            boxShadow: '0 1px 3px var(--accent-glow)',
          }}
        >
          <Icon name="mic" />
          Start a meeting
        </Link>
      </div>
    )
  }

  const cols = '1.4fr 2fr 1fr 30px'

  return (
    <div className="card overflow-hidden">
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: cols,
          padding: '10px 18px',
          fontSize: 10.5,
          color: 'var(--ink-3)',
          borderBottom: '0.5px solid var(--line-1)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono), monospace',
        }}
      >
        <div>Type</div>
        <div>Meeting</div>
        <div>Created</div>
        <div />
      </div>
      {documents.map((d, i) => {
        const primary = d.clientCompany || d.meetingTitle || d.title || 'Untitled meeting'
        const secondary =
          d.clientCompany && d.meetingTitle && d.meetingTitle !== d.clientCompany
            ? d.meetingTitle
            : null
        return (
          <Link
            key={d.id}
            href={`/meetings/${d.meeting_id}/documents/${d.id}`}
            className="grid items-center hover:bg-[rgba(28,24,20,0.025)] transition-colors"
            style={{
              gridTemplateColumns: cols,
              padding: '12px 18px',
              borderBottom: i < documents.length - 1 ? '0.5px solid var(--line-1)' : 'none',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0" style={{ color: 'var(--accent-base)' }}>
                <Icon name={DOC_TYPE_ICONS[d.doc_type]} />
              </span>
              <span
                className="text-[12.5px] font-medium truncate"
                style={{ color: 'var(--ink-1)' }}
              >
                {DOC_TYPE_LABELS[d.doc_type]}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] truncate" style={{ color: 'var(--ink-2)' }}>
                {primary}
              </div>
              {secondary && (
                <div
                  className="text-[11px] truncate"
                  style={{ color: 'var(--ink-3)', marginTop: 2 }}
                >
                  {secondary}
                </div>
              )}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
              {format(new Date(d.created_at), 'MMM d')}
            </div>
            <span style={{ color: 'var(--ink-3)' }}>
              <Icon name="chevR" size={12} />
            </span>
          </Link>
        )
      })}
    </div>
  )
}
