'use client'

import * as React from 'react'

/**
 * Fires a single POST to /api/p/[slug]/open on mount so we can
 * record proposals.first_opened_at + bump open_count without
 * needing per-recipient pixels.
 *
 * Uses sessionStorage to dedupe within a single browser session so
 * an SPA-style re-render doesn't inflate the count.
 */
export function RecordOpen({ slug }: { slug: string }) {
  React.useEffect(() => {
    const key = `pm:opened:${slug}`
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // Storage may be blocked (private mode / sandbox); still fire.
    }
    // No await — fire and forget. Failures are harmless.
    void fetch(`/api/p/${slug}/open`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {})
  }, [slug])
  return null
}
