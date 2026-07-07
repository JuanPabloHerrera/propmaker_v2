'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'
import { downloadProposalPptx, startBrandedDeckBuild } from '@/lib/download-pptx'
import type { ReferenceProposal } from '@/types'

interface Props {
  meetingId: string
  onSend: () => Promise<void>
  sending?: boolean
  proposalSlug?: string | null
  proposalId?: string | null
}

export function ExportActions({ onSend, sending, proposalSlug, proposalId }: Props) {
  const [exporting, setExporting] = React.useState(false)
  const [buildLabel, setBuildLabel] = React.useState('')
  const [templates, setTemplates] = React.useState<ReferenceProposal[]>([])
  const [templateId, setTemplateId] = React.useState('')
  const ctrlRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => () => ctrlRef.current?.abort(), [])

  React.useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/reference-proposals')
        if (!res.ok) return
        const rows = (await res.json()) as ReferenceProposal[]
        setTemplates(rows.filter((r) => r.source === 'pptx_template'))
      } catch {
        /* non-fatal — just no templates offered */
      }
    })()
  }, [])

  function comingSoon(label: string) {
    toast.info(`${label} export coming soon.`)
  }

  async function exportPptx() {
    if (exporting) return
    if (!proposalId) {
      toast.info('Save the proposal first.')
      return
    }
    // No template → instant fast branded deck. Template → Claude reproduces the
    // template on every slide via its pptx skill (a couple-minute background job).
    if (!templateId) {
      setExporting(true)
      try {
        await downloadProposalPptx(proposalId, null)
      } finally {
        setExporting(false)
      }
      return
    }
    setExporting(true)
    setBuildLabel('Building…')
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    toast.info(
      'Building your branded deck — this takes a couple of minutes. The download starts automatically when it’s ready.',
    )
    try {
      await startBrandedDeckBuild(proposalId, templateId, {
        signal: ctrl.signal,
        onStatus: (s) => setBuildLabel(s === 'succeeded' ? 'Done' : 'Building…'),
      })
      toast.success('Your branded deck is ready.')
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        toast.error(e instanceof Error ? e.message : 'Export failed')
      }
    } finally {
      setExporting(false)
      setBuildLabel('')
      ctrlRef.current = null
    }
  }

  function openPrintView() {
    if (proposalSlug) {
      // Open the public view in print mode.
      const w = window.open(`/p/${proposalSlug}?print=1`, '_blank')
      if (w) w.focus()
    } else {
      toast.info('Create a share link first.')
    }
  }

  return (
    <div
      className="card flex flex-col gap-2.5"
      style={{ padding: 14 }}
    >
      {templates.length > 0 && (
        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
            PowerPoint style template
          </span>
          <select
            className="field"
            style={{ height: 30, fontSize: 12, padding: '0 8px' }}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">None · brand colors</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={openPrintView}
          className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
          style={{
            height: 30,
            padding: '0 9px',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
        >
          <Icon name="download" size={12} />
          PDF
        </button>
        <button
          type="button"
          onClick={exportPptx}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
          style={{
            height: 30,
            padding: '0 9px',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
            opacity: exporting ? 0.5 : 1,
          }}
        >
          <Icon name="box" size={12} />
          {exporting ? buildLabel || 'Exporting…' : 'PowerPoint'}
        </button>
        <button
          type="button"
          onClick={() => comingSoon('Notion')}
          className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
          style={{
            height: 30,
            padding: '0 9px',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
        >
          <Icon name="copy" size={12} />
          Notion
        </button>
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 text-white font-medium"
        style={{
          height: 40,
          padding: '0 16px',
          fontSize: 13.5,
          borderRadius: 9,
          background:
            'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
          border: '0.5px solid rgba(77,138,107,0.6)',
          boxShadow:
            '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        <Icon name="send" size={14} />
        {sending ? 'Sending…' : 'Send proposal'}
      </button>
      <div
        className="text-center"
        style={{ fontSize: 10.5, color: 'var(--ink-3)' }}
      >
        Recipients will be notified via PropMaker (email send is in preview).
      </div>
    </div>
  )
}
