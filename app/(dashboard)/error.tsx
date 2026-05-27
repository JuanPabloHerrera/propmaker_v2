'use client'

import * as React from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Catches uncaught errors thrown anywhere in the (dashboard) route
 * tree so the user sees a recoverable message instead of a blank
 * page. `reset()` re-runs the segment that threw.
 */
export default function DashboardError({ error, reset }: Props) {
  React.useEffect(() => {
    // Surface to the console for dev; in production this would go to
    // an error tracker like Sentry. Don't expose .stack to the user.
    console.error('[dashboard] route error', error)
  }, [error])

  return (
    <div
      className="pm-page"
      style={{ padding: '48px 36px', display: 'grid', placeItems: 'center', minHeight: '60vh' }}
    >
      <div
        className="card text-center"
        style={{ padding: '28px 32px', maxWidth: 440 }}
        role="alert"
      >
        <div className="pm-eyebrow mb-1.5" style={{ color: 'var(--rec)' }}>
          Something went wrong
        </div>
        <h1
          className="text-[16px] font-semibold mb-2"
          style={{ color: 'var(--ink-1)' }}
        >
          We hit a snag loading this page.
        </h1>
        <p
          className="text-[12.5px] leading-relaxed mb-4"
          style={{ color: 'var(--ink-2)' }}
        >
          {error.message || 'An unexpected error occurred.'}
          {error.digest && (
            <>
              <br />
              <span className="mono-num" style={{ color: 'var(--ink-3)' }}>
                ref {error.digest}
              </span>
            </>
          )}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="text-[12.5px] font-medium"
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 7,
              color: 'white',
              background:
                'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
              border: '0.5px solid rgba(77,138,107,0.6)',
            }}
          >
            Try again
          </button>
          <a
            href="/"
            className="text-[12.5px] font-medium inline-flex items-center"
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 7,
              color: 'var(--ink-1)',
              background: 'rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(28,24,20,0.10)',
            }}
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
