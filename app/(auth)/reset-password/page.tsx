'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PasswordField } from '@/components/ui/password-field'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setHasSession(Boolean(data.session))
      setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  function validate(): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirm) return 'Passwords do not match.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) {
      setFieldError(err)
      return
    }
    setFieldError(null)
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Password updated. Please sign in.')
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
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
            Set a new password.
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            Pick something strong — you&apos;ll use it to sign in.
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {checking ? (
            <div
              className="text-center"
              role="status"
              aria-live="polite"
              style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
            >
              Loading…
            </div>
          ) : !hasSession ? (
            <div className="text-center space-y-3">
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: 'var(--ink-1)',
                  letterSpacing: '-0.01em',
                }}
              >
                Link expired
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                This reset link is invalid or has expired. Please request a new one.
              </p>
              <Link
                href="/forgot-password"
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--accent-strong)',
                }}
                className="hover:underline"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="password" className="field-label">
                  New password
                </label>
                <PasswordField
                  id="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldError) setFieldError(null)
                  }}
                  required
                  minLength={8}
                  aria-invalid={fieldError ? 'true' : 'false'}
                  aria-describedby={fieldError ? 'password-error' : undefined}
                />
              </div>
              <div>
                <label htmlFor="confirm" className="field-label">
                  Confirm password
                </label>
                <PasswordField
                  id="confirm"
                  autoComplete="new-password"
                  placeholder="Repeat the password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    if (fieldError) setFieldError(null)
                  }}
                  required
                  minLength={8}
                  aria-invalid={fieldError ? 'true' : 'false'}
                  aria-describedby={fieldError ? 'password-error' : undefined}
                />
              </div>
              {fieldError && (
                <p
                  id="password-error"
                  role="alert"
                  style={{ fontSize: 11.5, color: 'var(--rec)' }}
                >
                  {fieldError}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !password || !confirm}
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
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
