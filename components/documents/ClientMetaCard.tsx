'use client'

import * as React from 'react'
import { toast } from 'sonner'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
  onSaved?: () => void
}

/**
 * Editable auto-detected meeting metadata on the documents hub. The values are
 * extracted from the transcript after the meeting; this card lets the
 * consultant correct them before generating documents.
 */
export function ClientMetaCard({ meeting, onSaved }: Props) {
  const [title, setTitle] = React.useState(meeting.title ?? '')
  const [clientCompany, setClientCompany] = React.useState(meeting.client_company ?? '')
  const [contextSummary, setContextSummary] = React.useState(meeting.context_summary ?? '')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setTitle(meeting.title ?? '')
    setClientCompany(meeting.client_company ?? '')
    setContextSummary(meeting.context_summary ?? '')
  }, [meeting.title, meeting.client_company, meeting.context_summary])

  const dirty =
    title !== (meeting.title ?? '') ||
    clientCompany !== (meeting.client_company ?? '') ||
    contextSummary !== (meeting.context_summary ?? '')

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || meeting.title,
          client_company: clientCompany.trim() || null,
          context_summary: contextSummary.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }
      toast.success('Meeting details saved.')
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const attendees = meeting.attendees?.map((a) => a.name).filter(Boolean).join(', ')

  return (
    <div className="card p-[18px] self-start">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          Meeting details
        </div>
        <span className="pm-eyebrow">Auto-detected</span>
      </div>

      <label className="block mb-3">
        <span className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
          Title
        </span>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="block mb-3">
        <span className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
          Client / Company
        </span>
        <input
          className="field"
          placeholder="Detected from the conversation"
          value={clientCompany}
          onChange={(e) => setClientCompany(e.target.value)}
        />
      </label>

      <label className="block mb-3">
        <span className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
          Context
        </span>
        <textarea
          className="field"
          style={{ minHeight: 70, padding: '8px 11px' }}
          value={contextSummary}
          onChange={(e) => setContextSummary(e.target.value)}
        />
      </label>

      {attendees && (
        <div className="mb-3">
          <span className="block text-[11px] font-medium mb-1" style={{ color: 'var(--ink-2)' }}>
            Attendees
          </span>
          <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {attendees}
          </div>
        </div>
      )}

      {meeting.language && (
        <div className="mb-3">
          <span className="block text-[11px] font-medium mb-1" style={{ color: 'var(--ink-2)' }}>
            Document language
          </span>
          <div className="text-[12px] uppercase mono-num" style={{ color: 'var(--ink-3)' }}>
            {meeting.language}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="inline-flex items-center justify-center gap-1.5 font-medium w-full"
        style={{
          height: 32,
          borderRadius: 8,
          fontSize: 12,
          color: dirty ? '#fff' : 'var(--ink-3)',
          background: dirty
            ? 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)'
            : 'rgba(255,255,255,0.5)',
          border: dirty ? '0.5px solid rgba(77,138,107,0.6)' : '0.5px solid var(--line-1)',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save details'}
      </button>
    </div>
  )
}
