'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientMetaCard } from '@/components/documents/ClientMetaCard'
import { NotesPad } from '@/components/meeting/NotesPad'
import { AgentWorkingOverlay } from '@/components/documents/AgentWorkingOverlay'
import { DOC_TYPE_LABELS, type DocType, type Meeting, type MeetingDocument } from '@/types'

type DocRow = Pick<
  MeetingDocument,
  'id' | 'doc_type' | 'title' | 'language' | 'status' | 'public_slug' | 'created_at' | 'updated_at'
>

const GENERATORS: Array<{ type: DocType; icon: 'list' | 'doc' | 'pen' | 'sparkle'; blurb: string }> = [
  {
    type: 'minute',
    icon: 'list',
    blurb: 'Formal minutes — attendees, topics, decisions, and action items — from the transcript and the in-meeting co-pilot.',
  },
  {
    type: 'summary',
    icon: 'doc',
    blurb: 'A two-minute narrative summary of the conversation for anyone who missed the call.',
  },
  {
    type: 'proposal',
    icon: 'pen',
    blurb: 'A full proposal priced from your catalog, structured like your most similar past proposal.',
  },
  {
    type: 'notes',
    icon: 'sparkle',
    blurb: 'Your own notes, cleaned up and structured into a shareable document — nothing from the transcript.',
  },
]

export default function DocumentsHubPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [meeting, setMeeting] = React.useState<Meeting | null>(null)
  const [docs, setDocs] = React.useState<DocRow[] | null>(null)
  const [generating, setGenerating] = React.useState<DocType | null>(null)

  const fetchData = React.useCallback(async () => {
    const [meetingRes, docsRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).single(),
      fetch(`/api/meetings/${id}/documents`).then((r) => (r.ok ? r.json() : [])),
    ])
    if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
    setDocs(Array.isArray(docsRes) ? (docsRes as DocRow[]) : [])
  }, [id, supabase])

  React.useEffect(() => {
    fetchData()
    // Fallback trigger for metadata extraction (idempotent server-side), then
    // refresh once so the auto-detected title/client appear without a reload.
    fetch(`/api/meetings/${id}/extract`, { method: 'POST' })
      .then(() => fetchData())
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function generate(type: DocType) {
    if (generating) return
    setGenerating(type)
    try {
      const res = await fetch(`/api/meetings/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      router.push(`/meetings/${id}/documents/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
      setGenerating(null)
    }
  }

  if (!meeting || docs === null) {
    return (
      <div className="pm-page lg-shell" style={{ padding: '28px 36px 32px' }}>
        <Skeleton style={{ height: 28, width: 280, marginBottom: 22 }} />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 160, width: '100%', borderRadius: 14 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <AgentWorkingOverlay
        open={generating !== null}
        title={`Generating your ${generating ? DOC_TYPE_LABELS[generating].toLowerCase() : 'document'}…`}
        subtitle="The AI agent is reading the meeting and writing the document — it will open automatically when it's ready."
      />

      <Link
        href="/"
        className="inline-flex items-center gap-1 mb-3"
        style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
      >
        <Icon name="chevL" size={12} />
        Back
      </Link>

      <div className="pm-eyebrow">Meeting documents</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        {meeting.title}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 22 }}>
        {meeting.client_company ? `${meeting.client_company} · ` : ''}
        {format(new Date(meeting.created_at), 'MMM d, yyyy')}
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {GENERATORS.map((g) => (
              <button
                key={g.type}
                type="button"
                disabled={generating !== null}
                onClick={() => generate(g.type)}
                className="card text-left"
                style={{
                  borderRadius: 14,
                  padding: '18px 16px',
                  cursor: generating ? 'default' : 'pointer',
                  opacity: generating && generating !== g.type ? 0.55 : 1,
                }}
              >
                <div className="mb-2">
                  <Icon name={g.icon} size={18} />
                </div>
                <div className="text-[13.5px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                  {generating === g.type ? 'Generating…' : DOC_TYPE_LABELS[g.type]}
                </div>
                <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                  {g.blurb}
                </div>
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div
              className="text-[13px] font-semibold"
              style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--line-1)', color: 'var(--ink-1)' }}
            >
              Generated documents
            </div>
            {docs.length === 0 ? (
              <div className="p-6 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Nothing yet — pick a document type above to generate the first one.
              </div>
            ) : (
              docs.map((d, i) => (
                <Link
                  key={d.id}
                  href={`/meetings/${id}/documents/${d.id}`}
                  className="flex items-center gap-3 hover:bg-[rgba(28,24,20,0.025)] transition-colors"
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < docs.length - 1 ? '0.5px solid var(--line-1)' : 'none',
                  }}
                >
                  <Icon name="doc" size={14} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink-1)' }}>
                      {DOC_TYPE_LABELS[d.doc_type]}
                      {d.title ? ` — ${d.title}` : ''}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {format(new Date(d.created_at), 'MMM d · h:mm a')}
                      {d.status === 'final' ? ' · Final' : ' · Draft'}
                      {d.public_slug ? ' · Shared' : ''}
                    </div>
                  </div>
                  <Icon name="chevR" size={12} />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ClientMetaCard meeting={meeting} onSaved={fetchData} />

          <div className="card overflow-hidden flex flex-col" style={{ height: 360 }}>
            <div
              className="text-[13px] font-semibold shrink-0"
              style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--line-1)', color: 'var(--ink-1)' }}
            >
              Meeting notes
            </div>
            <div className="flex-1 min-h-0">
              <NotesPad meetingId={id} initialJson={meeting.notes_json} variant="card" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
