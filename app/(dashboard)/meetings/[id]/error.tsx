'use client'

import * as React from 'react'
import Link from 'next/link'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Tighter error UI for the meeting-specific subtree (live, processing,
 * qa, proposal, share). Bubbles up to the dashboard error boundary
 * only if it rethrows.
 */
export default function MeetingError({ error, reset }: Props) {
  React.useEffect(() => {
    console.error('[meeting] route error', error)
  }, [error])

  return (
    <div
      className="flex-1 grid place-items-center lg-shell"
      style={{ padding: '40px 32px' }}
    >
      <div
        className="card text-center"
        style={{ padding: '24px 28px', maxWidth: 420 }}
        role="alert"
      >
        <div className="pm-eyebrow mb-1.5" style={{ color: 'var(--rec)' }}>
          Meeting load failed
        </div>
        <p
          className="text-[12.5px] leading-relaxed mb-4"
          style={{ color: 'var(--ink-2)' }}
        >
          {error.message || 'We could not load this meeting.'}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="text-[12px] font-medium"
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 7,
              color: 'white',
              background:
                'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
              border: '0.5px solid rgba(77,138,107,0.6)',
            }}
          >
            Retry
          </button>
          <Link
            href="/"
            className="text-[12px] font-medium inline-flex items-center"
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 7,
              color: 'var(--ink-1)',
              background: 'rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(28,24,20,0.10)',
            }}
          >
            All meetings
          </Link>
        </div>
      </div>
    </div>
  )
}
