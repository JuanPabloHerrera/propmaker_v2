'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'
import { startBrandedDeckBuild, type ExportFormat } from '@/lib/download-pptx'
import type { ReferenceProposal } from '@/types'

interface Props {
  meetingId: string
  onSend: () => Promise<void>
  sending?: boolean
  proposalSlug?: string | null
  proposalId?: string | null
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pptx: 'PowerPoint',
  docx: 'Word',
  pdf: 'PDF',
}

export function ExportActions({ onSend, sending, proposalSlug, proposalId }: Props) {
  const [exporting, setExporting] = React.useState<ExportFormat | null>(null)
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

  async function exportAs(format: ExportFormat) {
    if (exporting) return
    if (!proposalId) {
      toast.info('Generate the document first.')
      return
    }
    // Claude always builds the file (a couple-minute background job): pptx with
    // a template reproduces it on every slide; otherwise it designs from the
    // user's brand. Word/PDF are branded letter-format documents.
    setExporting(format)
    setBuildLabel('Building…')
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    toast.info(
      `Building your branded ${FORMAT_LABEL[format]} — this takes a couple of minutes. The download starts automatically when it’s ready.`,
    )
    try {
      const { engine, note } = await startBrandedDeckBuild(
        proposalId,
        format === 'pptx' ? templateId || null : null,
        {
          signal: ctrl.signal,
          format,
          onStatus: (s) => setBuildLabel(s === 'succeeded' ? 'Done' : 'Building…'),
        },
      )
      if (engine === 'fast') {
        toast.warning(
          note
            ? `Delivered a lite deck — the Claude build was unavailable: ${note}`
            : 'Delivered a lite deck — the Claude build was unavailable.',
        )
      } else {
        toast.success(`Your branded ${FORMAT_LABEL[format]} is ready.`)
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        const msg = e instanceof Error ? e.message : 'Export failed'
        if (format === 'pdf' && proposalSlug) {
          toast.error(`${msg} — try the quick print view below instead.`)
        } else {
          toast.error(msg)
        }
      }
    } finally {
      setExporting(null)
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

  const exportButtonStyle = (active: boolean): React.CSSProperties => ({
    height: 30,
    padding: '0 9px',
    borderRadius: 7,
    fontSize: 12,
    color: 'var(--ink-1)',
    background: 'rgba(255,255,255,0.6)',
    border: '0.5px solid rgba(28,24,20,0.10)',
    opacity: exporting && !active ? 0.5 : 1,
  })

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
            <option value="">None · build from brand</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2.5">
        {(['docx', 'pdf', 'pptx'] as ExportFormat[]).map((format) => (
          <button
            key={format}
            type="button"
            onClick={() => exportAs(format)}
            disabled={exporting !== null}
            className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
            style={exportButtonStyle(exporting === format)}
          >
            <Icon name={format === 'pptx' ? 'box' : 'download'} size={12} />
            {exporting === format ? buildLabel || 'Exporting…' : FORMAT_LABEL[format]}
          </button>
        ))}
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
        {sending ? 'Sending…' : 'Send document'}
      </button>
      <button
        type="button"
        onClick={openPrintView}
        className="text-center"
        style={{ fontSize: 10.5, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        Quick PDF via print view · Recipients are notified via PropMaker (email send is in preview).
      </button>
    </div>
  )
}
