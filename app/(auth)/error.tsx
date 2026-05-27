'use client'

import * as React from 'react'
import Link from 'next/link'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthError({ error, reset }: Props) {
  React.useEffect(() => {
    console.error('[auth] route error', error)
  }, [error])

  return (
    <div className="min-h-screen lg-shell flex items-center justify-center px-4">
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div className="card text-center" style={{ padding: 28 }} role="alert">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              margin: '0 auto 16px',
              background:
                'linear-gradient(135deg, var(--rec) 0%, #d05656 60%, #e6c992 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow:
                '0 6px 22px rgba(176, 52, 52, 0.25), inset 0 1px 0 rgba(255,255,255,0.5)',
              color: 'white',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 8v5M12 16.5v.01"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M10.3 3.5l-8 13.5a2 2 0 001.7 3h16a2 2 0 001.7-3l-8-13.5a2 2 0 00-3.4 0z"
                stroke="white"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="pm-eyebrow" style={{ marginBottom: 4 }}>
            Auth error
          </div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: 'var(--ink-1)',
              marginBottom: 6,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              marginBottom: 18,
            }}
          >
            {error.message || 'We could not complete that step.'}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center text-white font-medium"
              style={{
                height: 34,
                padding: '0 14px',
                fontSize: 12.5,
                borderRadius: 9,
                background:
                  'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                border: '0.5px solid rgba(77, 138, 107, 0.6)',
                boxShadow:
                  '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              Try again
            </button>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center font-medium"
              style={{
                height: 34,
                padding: '0 14px',
                fontSize: 12.5,
                borderRadius: 9,
                color: 'var(--ink-1)',
                background: 'rgba(255, 255, 255, 0.6)',
                border: '0.5px solid rgba(28, 24, 20, 0.10)',
                boxShadow:
                  '0 1px 2px rgba(28, 22, 14, 0.06), inset 0 0.5px 0 rgba(255, 255, 255, 0.7)',
              }}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
