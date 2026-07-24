'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { tiptapToText } from '@/lib/tiptap'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentWorkingOverlay } from '@/components/documents/AgentWorkingOverlay'
import { InsufficientCreditsModal } from '@/components/billing/InsufficientCreditsModal'
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
  const [insufficient, setInsufficient] = React.useState<{ balance: number } | null>(null)

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
      if (res.status === 402) {
        setInsufficient({ balance: typeof data.balance === 'number' ? data.balance : 0 })
        setGenerating(null)
        return
      }
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

  // The notes document is built ONLY from the consultant's own typed notes, so
  // it can't be generated for a meeting that has none (uploads, or calls where
  // nobody took notes). Gate the card instead of letting the click 422.
  const hasNotes = tiptapToText(meeting.notes_json).trim().length > 0

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <AgentWorkingOverlay
        open={generating !== null}
        title={`Generating your ${generating ? DOC_TYPE_LABELS[generating].toLowerCase() : 'document'}…`}
        subtitle="The AI agent is reading the meeting and writing the document — it will open automatically when it's ready."
      />

      <InsufficientCreditsModal
        open={insufficient !== null}
        balance={insufficient?.balance ?? 0}
        onClose={() => setInsufficient(null)}
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

      <div className="grid grid-cols-2 gap-4">
        {GENERATORS.map((g) => {
          // Notes can only be built from the user's own notes — disable the card
          // when there are none rather than letting the request 422.
          const needsNotes = g.type === 'notes' && !hasNotes
          const dimmed = needsNotes || (generating != null && generating !== g.type)
          return (
            <button
              key={g.type}
              type="button"
              disabled={generating !== null || needsNotes}
              onClick={() => {
                if (!needsNotes) generate(g.type)
              }}
              className="card text-left"
              style={{
                borderRadius: 14,
                padding: '18px 16px',
                cursor: generating || needsNotes ? 'default' : 'pointer',
                opacity: dimmed ? 0.55 : 1,
              }}
            >
              <div className="mb-2">
                <Icon name={g.icon} size={18} />
              </div>
              <div className="text-[13.5px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                {generating === g.type ? 'Generating…' : DOC_TYPE_LABELS[g.type]}
              </div>
              <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                {needsNotes
                  ? 'Add notes during the meeting to enable this — the notes document is built only from your own notes.'
                  : g.blurb}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
