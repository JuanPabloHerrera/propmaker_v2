'use client'

import * as React from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PublicProposalError({ error, reset }: Props) {
  React.useEffect(() => {
    console.error('[public-proposal] route error', error)
  }, [error])

  return (
    <div className="min-h-screen lg-shell grid place-items-center" style={{ padding: 32 }}>
      <div
        className="card text-center"
        style={{ padding: '28px 32px', maxWidth: 440 }}
        role="alert"
      >
        <h1
          className="text-[16px] font-semibold mb-2"
          style={{ color: 'var(--ink-1)' }}
        >
          This proposal could not be loaded.
        </h1>
        <p
          className="text-[12.5px] mb-4 leading-relaxed"
          style={{ color: 'var(--ink-2)' }}
        >
          The link may be expired or the proposal was unpublished.
        </p>
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
          Retry
        </button>
      </div>
    </div>
  )
}
