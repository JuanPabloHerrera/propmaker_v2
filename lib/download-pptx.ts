'use client'

import { toast } from 'sonner'

/**
 * Fetch a proposal's generated .pptx from the export API and trigger a browser
 * download. Shared by the proposal toolbar and the Share screen so the blob
 * plumbing lives in one place. Toasts on failure.
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
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') || ''
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'proposal.pptx'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export failed')
  }
}
