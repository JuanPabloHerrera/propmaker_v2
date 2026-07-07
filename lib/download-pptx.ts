'use client'

import { toast } from 'sonner'

const PPTX_CT =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

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

function filenameFrom(res: Response, fallback = 'proposal.pptx'): string {
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
 * Instant export (no template): the serverless route builds a fast branded deck
 * with pptxgenjs and streams it back. Toasts on failure.
 */
export async function downloadProposalPptx(
  proposalId: string | null | undefined,
  templateId?: string | null,
) {
  if (!proposalId) {
    toast.info('Save the proposal first.')
    return
  }
  try {
    const qs = templateId ? `?template=${encodeURIComponent(templateId)}` : ''
    const res = await fetch(`/api/proposals/${proposalId}/export/pptx${qs}`)
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

/**
 * High-fidelity export (template selected): POST starts a background job where
 * Claude reproduces the brand template on every slide via its `pptx` skill;
 * we then poll the download endpoint until the finished .pptx is ready and
 * trigger the browser download. Resolves when done, rejects (with a friendly
 * message) on terminal failure or timeout. Honors an AbortSignal for unmount.
 */
export async function startBrandedDeckBuild(
  proposalId: string,
  templateId: string,
  opts: { signal?: AbortSignal; onStatus?: (s: DeckBuildStatus) => void } = {},
): Promise<void> {
  const { signal, onStatus } = opts

  const start = await fetch(
    `/api/proposals/${proposalId}/export/pptx?template=${encodeURIComponent(templateId)}`,
    { method: 'POST', signal },
  )
  if (!start.ok) {
    const err = await start.json().catch(() => ({}))
    throw new Error(err.error ?? 'Could not start the export.')
  }
  const { jobId } = (await start.json()) as { jobId?: string }
  if (!jobId) throw new Error('Could not start the export.')
  onStatus?.('running')

  const dlUrl = `/api/proposals/${proposalId}/export/pptx/download?job=${jobId}`
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
    if (ct.includes(PPTX_CT) || ct.includes('presentation')) {
      triggerBrowserDownload(await res.blob(), filenameFrom(res))
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
