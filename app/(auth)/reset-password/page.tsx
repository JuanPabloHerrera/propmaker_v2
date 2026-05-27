'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">PropCopilot</h1>
          <p className="text-sm text-[#6e6e73] mt-1">Set a new password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#d2d2d7] p-8">
          {checking ? (
            <div className="text-center text-[13px] text-[#6e6e73]" role="status" aria-live="polite">
              Loading…
            </div>
          ) : !hasSession ? (
            <div className="text-center space-y-3">
              <div className="text-[15px] font-medium text-[#1d1d1f]">Link expired</div>
              <p className="text-[13px] text-[#6e6e73] leading-relaxed">
                This reset link is invalid or has expired. Please request a new one.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block text-[13px] text-[#1d1d1f] font-medium hover:underline mt-2"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-[#1d1d1f]">
                  New password
                </Label>
                <Input
                  id="password"
                  type="password"
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
                  className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-medium text-[#1d1d1f]">
                  Confirm password
                </Label>
                <Input
                  id="confirm"
                  type="password"
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
                  className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white transition-colors"
                />
              </div>
              {fieldError && (
                <p
                  id="password-error"
                  role="alert"
                  className="text-[12px] text-[#c93a3a]"
                >
                  {fieldError}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full h-10 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white font-medium transition-colors"
              >
                {loading ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
