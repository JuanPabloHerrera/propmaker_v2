'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * `/auth/callback` bounces failures back here as `?error=<code>`. Without this
 * the flag was silently dropped and a broken auth leg showed up only as a
 * console error, which is how the stray PKCE 400 went unnoticed.
 */
const MESSAGES: Record<string, string> = {
  auth_callback_failed: 'We could not complete that sign-in link. Please try again.',
  missing_code: 'That sign-in link is incomplete. Please request a new one.',
  exchange_failed: 'That sign-in link could not be verified. Please request a new one.',
  otp_expired: 'That link has expired. Please request a new one.',
  flow_state_expired: 'That link has expired. Please request a new one.',
  flow_state_not_found:
    'That link was already used, or was opened in a different browser. Please request a new one.',
  access_denied: 'That sign-in link was denied. Please request a new one.',
  validation_failed: 'That sign-in link is invalid. Please request a new one.',
}

export function AuthErrorToast() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const shown = useRef<string | null>(null)

  useEffect(() => {
    if (!error || shown.current === error) return
    shown.current = error

    toast.error(MESSAGES[error] ?? 'Something went wrong signing you in. Please try again.')

    // Drop the flag so a reload doesn't re-toast the same stale failure.
    const rest = new URLSearchParams(searchParams)
    rest.delete('error')
    const query = rest.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [error, pathname, router, searchParams])

  return null
}
