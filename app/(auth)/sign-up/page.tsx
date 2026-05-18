'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Check your email for a confirmation link.')
    router.push('/sign-in')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">PropCopilot</h1>
          <p className="text-sm text-[#6e6e73] mt-1">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#d2d2d7] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-[#1d1d1f]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-[#1d1d1f]">
                Password
                <span className="text-[#6e6e73] font-normal ml-1">(min 8 chars)</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white transition-colors"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white font-medium transition-colors"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-[#6e6e73] mt-6">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-[#1d1d1f] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
