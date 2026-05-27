'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">PropCopilot</h1>
          <p className="text-sm text-[#6e6e73] mt-1">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#d2d2d7] p-8">
          {sent ? (
            <div className="text-center space-y-3" role="status" aria-live="polite">
              <div className="text-[15px] font-medium text-[#1d1d1f]">Check your inbox</div>
              <p className="text-[13px] text-[#6e6e73] leading-relaxed">
                If an account exists for <span className="font-medium">{email}</span>, you&apos;ll receive a password reset link shortly.
              </p>
              <Link
                href="/sign-in"
                className="inline-block text-[13px] text-[#1d1d1f] font-medium hover:underline mt-2"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <p className="text-[13px] text-[#6e6e73] leading-relaxed">
                Enter the email associated with your account and we&apos;ll send you a link to set a new password.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-[#1d1d1f]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white transition-colors"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full h-10 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white font-medium transition-colors"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}

          {!sent && (
            <p className="text-center text-sm text-[#6e6e73] mt-6">
              Remembered it?{' '}
              <Link href="/sign-in" className="text-[#1d1d1f] font-medium hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
