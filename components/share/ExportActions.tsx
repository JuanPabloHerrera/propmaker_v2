'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'
import { AgentWorkingOverlay } from '@/components/documents/AgentWorkingOverlay'
import { startBrandedDeckBuild, type ExportFormat } from '@/lib/download-pptx'
import type { ReferenceProposal } from '@/types'

interface Props {
  documentId: string
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pptx: 'PowerPoint',
  docx: 'Word',
  pdf: 'PDF',
}

/**
 * The export card — the entire share screen. Pick an optional PowerPoint brand
 * template, then export to Word, PDF, or PowerPoint. Every export is built by
 * the Claude agent (no fallback engine): the overlay asks the user to keep the
 * page open until the download fires; a failed build toasts "try again".
 */
export function ExportActions({ documentId }: Props) {
  const [exporting, setExporting] = React.useState<ExportFormat | null>(null)
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
    setExporting(format)
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    try {
      await startBrandedDeckBuild(
        documentId,
        format === 'pptx' ? templateId || null : null,
        { signal: ctrl.signal, format },
      )
      toast.success(`Your ${FORMAT_LABEL[format]} is ready — download started.`)
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        const reason = e instanceof Error ? e.message : ''
        toast.error(
          `The ${FORMAT_LABEL[format]} export failed — please try again.${reason ? ` (${reason})` : ''}`,
        )
      }
    } finally {
      setExporting(null)
      ctrlRef.current = null
    }
  }

  return (
    <>
      <AgentWorkingOverlay
        open={exporting !== null}
        title={`Building your branded ${exporting ? FORMAT_LABEL[exporting] : 'document'}…`}
        subtitle="The AI agent is designing and assembling your file — this takes a couple of minutes. Your download will start automatically the moment it's ready."
      />

      <div className="card flex flex-col gap-3" style={{ padding: 18 }}>
        <label className="flex flex-col gap-1.5">
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-2)' }}>
            PowerPoint style template
          </span>
          <select
            className="field"
            style={{ height: 34, fontSize: 12.5, padding: '0 10px' }}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={exporting !== null}
          >
            <option value="">None · build from my brand</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
            Applies to PowerPoint only — Word and PDF always use your brand colors and logo.
          </span>
        </label>

        <div className="flex flex-col gap-2 mt-1">
          {(['docx', 'pdf', 'pptx'] as ExportFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => exportAs(format)}
              disabled={exporting !== null}
              className="inline-flex items-center justify-center gap-2 font-medium text-white"
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
                opacity: exporting !== null && exporting !== format ? 0.5 : 1,
              }}
            >
              <Icon name={format === 'pptx' ? 'box' : 'download'} size={14} />
              {exporting === format
                ? 'Building…'
                : `Export ${FORMAT_LABEL[format]}`}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
