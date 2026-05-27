'use client'

import { useEffect } from 'react'

// Triggers window.print() when the page is opened with ?print=1.
// Used by the PDF export flow: the in-app PDF button opens
// /p/[slug]?print=1 in a new window, which prints automatically.
export function AutoPrint() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('print') !== '1') return
    // Wait for layout + webfont swap so the first paint isn't stale.
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [])
  return null
}
