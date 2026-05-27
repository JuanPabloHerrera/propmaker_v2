'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== 'undefined' ? window.location.origin : '')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen lg-shell flex items-center justify-center px-4">
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div className="flex flex-col items-center text-center" style={{ marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background:
                'linear-gradient(135deg, var(--accent-base) 0%, var(--accent-2) 60%, #e6c992 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow:
                '0 8px 28px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.5)',
              marginBottom: 20,
              color: 'white',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <path
                d="M11 23V11h6a4 4 0 010 8h-3"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="pm-eyebrow">PropMaker</div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              margin: '4px 0 6px',
              color: 'var(--ink-1)',
            }}
          >
            Reset your password.
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            We&apos;ll email you a secure link to set a new one.
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {sent ? (
            <div className="text-center space-y-3" role="status" aria-live="polite">
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: 'var(--ink-1)',
                  letterSpacing: '-0.01em',
                }}
              >
                Check your inbox
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                If an account exists for{' '}
                <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{email}</span>, you&apos;ll
                receive a password reset link shortly.
              </p>
              <Link
                href="/sign-in"
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--accent-strong)',
                }}
                className="hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Enter the email associated with your account and we&apos;ll send you a link to set a
                new password.
              </p>
              <div>
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="field"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full inline-flex items-center justify-center text-white font-medium disabled:opacity-60"
                style={{
                  height: 38,
                  marginTop: 4,
                  fontSize: 13.5,
                  borderRadius: 9,
                  background:
                    'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                  border: '0.5px solid rgba(77, 138, 107, 0.6)',
                  boxShadow:
                    '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          {!sent && (
            <>
              <div className="hairline" style={{ margin: '20px 0 16px' }} />
              <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>
                Remembered it?{' '}
                <Link
                  href="/sign-in"
                  style={{ color: 'var(--accent-strong)', fontWeight: 500 }}
                  className="hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
