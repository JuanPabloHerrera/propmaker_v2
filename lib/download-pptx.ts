'use client'

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

function filenameFrom(res: Response, fallback: string): string {
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

export type DeckBuildStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/**
 * The one and only export path: POST starts a background job where Claude
 * builds the file inside a code-execution container via its document skill
 * (pptx / docx / pdf) — reproducing the brand template on every slide when one
 * is selected for pptx, or designing from the user's brand otherwise. We then
 * poll the download endpoint until the finished file is ready and trigger the
 * browser download. There is NO fallback engine: on terminal failure this
 * rejects with the server's error so the caller tells the user to try again.
 * Honors an AbortSignal for unmount.
 */
export async function startBrandedDeckBuild(
  documentId: string,
  templateId: string | null,
  opts: { signal?: AbortSignal; onStatus?: (s: DeckBuildStatus) => void; format?: ExportFormat } = {},
): Promise<void> {
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
      return
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
