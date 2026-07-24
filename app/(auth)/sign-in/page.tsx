'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PasswordField } from '@/components/ui/password-field'
import { toast } from 'sonner'

export default function SignInPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    router.push('/')
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
            Welcome back.
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            Sign in to pick up where you left off.
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <label htmlFor="password" className="field-label" style={{ marginBottom: 0 }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    fontWeight: 500,
                  }}
                  className="hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordField
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="hairline" style={{ margin: '20px 0 16px' }} />

          <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>
            Don&apos;t have an account?{' '}
            <Link
              href="/sign-up"
              style={{ color: 'var(--accent-strong)', fontWeight: 500 }}
              className="hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
