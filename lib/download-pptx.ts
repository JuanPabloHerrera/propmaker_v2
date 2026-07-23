'use client'

import { toast } from 'sonner'

export type ExportFormat = 'pptx' | 'docx' | 'pdf'

const FORMAT_CT: Record<ExportFormat, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
}

function triggerBrowserDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function filenameFrom(res: Response, fallback = 'document.pptx'): string {
  const cd = res.headers.get('Content-Disposition') || ''
  return /filename="([^"]+)"/.exec(cd)?.[1] ?? fallback
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/**
 * Instant export (pptx only, no Claude): the serverless route builds a fast
 * branded deck with pptxgenjs and streams it back. Toasts on failure.
 */
export async function downloadProposalPptx(
  documentId: string | null | undefined,
  templateId?: string | null,
) {
  if (!documentId) {
    toast.info('Generate the document first.')
    return
  }
  try {
    const qs = templateId ? `?template=${encodeURIComponent(templateId)}` : ''
    const res = await fetch(`/api/documents/${documentId}/export${qs}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Export failed')
    }
    triggerBrowserDownload(await res.blob(), filenameFrom(res))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export failed')
  }
}

export type DeckBuildStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/** Which builder produced the delivered file. `fast` = Claude was unavailable
 *  and we served the lite pptxgenjs fallback (pptx only, with `note` = why). */
export type DeckBuildResult = { engine: 'skill' | 'fast'; note?: string }

/**
 * The canonical export for every format: POST starts a background job where
 * Claude builds the file inside a code-execution container via its document
 * skill (pptx / docx / pdf) — reproducing the brand template on every slide
 * when one is selected for pptx, or designing from the user's brand otherwise.
 * We then poll the download endpoint until the finished file is ready and
 * trigger the browser download. Resolves with the engine that produced the file
 * (so the caller can warn on the pptx `fast` fallback), rejects (with a
 * friendly message) on terminal failure or timeout. Honors an AbortSignal.
 */
export async function startBrandedDeckBuild(
  documentId: string,
  templateId: string | null,
  opts: { signal?: AbortSignal; onStatus?: (s: DeckBuildStatus) => void; format?: ExportFormat } = {},
): Promise<DeckBuildResult> {
  const { signal, onStatus } = opts
  const format = opts.format ?? 'pptx'

  const qs = new URLSearchParams({ format })
  if (templateId) qs.set('template', templateId)
  const start = await fetch(`/api/documents/${documentId}/export?${qs}`, {
    method: 'POST',
    signal,
  })
  if (!start.ok) {
    const err = await start.json().catch(() => ({}))
    throw new Error(err.error ?? 'Could not start the export.')
  }
  const { jobId } = (await start.json()) as { jobId?: string }
  if (!jobId) throw new Error('Could not start the export.')
  onStatus?.('running')

  const dlUrl = `/api/documents/${documentId}/export/download?job=${jobId}`
  const deadline = Date.now() + 6 * 60 * 1000 // ~6 min client-side ceiling

  while (Date.now() < deadline) {
    await sleep(6000, signal)
    const res = await fetch(dlUrl, { signal })

    if (res.status === 202) {
      const body = (await res.json().catch(() => ({}))) as { status?: DeckBuildStatus }
      onStatus?.(body.status ?? 'running')
      continue
    }
    if (!res.ok) throw new Error('Export failed')

    const ct = res.headers.get('Content-Type') || ''
    if (ct.includes(FORMAT_CT[format]) || ct.includes('officedocument') || ct.includes('pdf')) {
      triggerBrowserDownload(await res.blob(), filenameFrom(res, `document.${format}`))
      onStatus?.('succeeded')
      const engine = res.headers.get('X-Deck-Engine') === 'fast' ? 'fast' : 'skill'
      const note = res.headers.get('X-Deck-Note') || undefined
      return { engine, note }
    }
    // 200 JSON → terminal status (e.g. failed).
    const body = (await res.json().catch(() => ({}))) as {
      status?: DeckBuildStatus
      error?: string
    }
    if (body.status === 'failed') {
      onStatus?.('failed')
      throw new Error(body.error ?? 'Export failed')
    }
    onStatus?.(body.status ?? 'running')
  }
  throw new Error('Still building — check back in a moment.')
}
