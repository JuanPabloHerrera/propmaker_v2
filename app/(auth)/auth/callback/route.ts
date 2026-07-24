import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Only same-origin, non-protocol-relative paths may be redirected to.
 * `//evil.com` is a valid pathname but resolves off-site once appended
 * to an origin, so it must be rejected alongside absolute URLs.
 */
function safeNext(next: string | null): string {
  if (!next || !/^\/(?!\/)/.test(next)) return '/'
  return next
}

/**
 * On Vercel the request origin can be the internal deployment host rather
 * than the public domain, so prefer the forwarded host when present.
 */
function publicOrigin(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (!forwardedHost) return fallbackOrigin
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${forwardedHost}`
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const baseUrl = publicOrigin(request, origin)
  const next = safeNext(searchParams.get('next'))

  // Supabase redirects here with `error`/`error_description` and NO code when
  // it rejects the link itself (expired, already consumed, redirect not
  // allow-listed). Handle that before looking for a code.
  const providerError = searchParams.get('error')
  if (providerError) {
    const description = searchParams.get('error_description')
    console.error('[auth/callback] provider rejected the link', {
      error: providerError,
      code: searchParams.get('error_code'),
      description,
    })
    return NextResponse.redirect(
      `${baseUrl}/sign-in?error=${encodeURIComponent(providerError)}`
    )
  }

  const code = searchParams.get('code')
  if (!code) {
    console.error('[auth/callback] reached without a code or an error param')
    return NextResponse.redirect(`${baseUrl}/sign-in?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Don't swallow this — it's the only record of why an auth leg failed.
    console.error('[auth/callback] code exchange failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    })
    return NextResponse.redirect(
      `${baseUrl}/sign-in?error=${encodeURIComponent(error.code ?? 'exchange_failed')}`
    )
  }

  return NextResponse.redirect(`${baseUrl}${next}`)
}
