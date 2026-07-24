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

export interface MeetingGroup {
  meetingId: string
  meetingTitle: string | null
  clientCompany: string | null
  /** Meeting date — groups are ordered by this, newest first. */
  meetingDate: string
  /** Documents for this meeting, already newest-first. */
  documents: DocumentRow[]
}

const DOC_TYPE_ICONS: Record<DocType, IconName> = {
  minute: 'list',
  summary: 'doc',
  proposal: 'pen',
  notes: 'sparkle',
}

interface Props {
  groups: MeetingGroup[]
}

export function DocumentsTable({ groups }: Props) {
  if (groups.length === 0) {
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

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <MeetingGroupCard key={g.meetingId} group={g} />
      ))}
    </div>
  )
}

function MeetingGroupCard({ group }: { group: MeetingGroup }) {
  const primary =
    group.clientCompany || group.meetingTitle || 'Untitled meeting'
  const secondary =
    group.clientCompany && group.meetingTitle && group.meetingTitle !== group.clientCompany
      ? group.meetingTitle
      : null

  // Within a group the meeting is already known, so drop the "Meeting" column.
  const cols = '1.6fr 1fr 30px'

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between gap-3"
        style={{
          padding: '11px 18px',
          borderBottom: '0.5px solid var(--line-1)',
          background: 'rgba(28,24,20,0.015)',
        }}
      >
        <Link
          href={`/meetings/${group.meetingId}/documents`}
          className="min-w-0 hover:underline"
        >
          <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--ink-1)' }}>
            {primary}
          </div>
          {secondary && (
            <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)', marginTop: 2 }}>
              {secondary}
            </div>
          )}
        </Link>
        <div
          className="text-[11.5px] shrink-0"
          style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono), monospace' }}
        >
          {format(new Date(group.meetingDate), 'MMM d, yyyy')}
        </div>
      </div>

      {group.documents.map((d, i) => (
        <Link
          key={d.id}
          href={`/meetings/${d.meeting_id}/documents/${d.id}`}
          className="grid items-center hover:bg-[rgba(28,24,20,0.025)] transition-colors"
          style={{
            gridTemplateColumns: cols,
            padding: '11px 18px',
            borderBottom: i < group.documents.length - 1 ? '0.5px solid var(--line-1)' : 'none',
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
          <div className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            {format(new Date(d.created_at), 'MMM d')}
          </div>
          <span style={{ color: 'var(--ink-3)' }}>
            <Icon name="chevR" size={12} />
          </span>
        </Link>
      ))}
    </div>
  )
}
