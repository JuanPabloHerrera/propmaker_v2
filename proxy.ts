import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Routes that don't require auth.
  // `/reset-password` is included because it's reachable both for the
  // unauthenticated case (expired link → renders the "request a new
  // link" state) and the recovery-session case (Supabase issues a
  // temporary session via the callback). Do NOT redirect logged-in
  // users away from it — that would block the password update form.
  const isPublicAuthRoute =
    path.startsWith('/sign-in') ||
    path.startsWith('/sign-up') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password')

  // Routes from which a logged-in user should bounce back to the app.
  const isSignedInBounceRoute =
    path.startsWith('/sign-in') ||
    path.startsWith('/sign-up') ||
    path.startsWith('/forgot-password')

  const isApiRoute = path.startsWith('/api/')

  if (!user && !isPublicAuthRoute && !isApiRoute) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  if (user && isSignedInBounceRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
