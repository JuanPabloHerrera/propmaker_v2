import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // `createBrowserClient` pins flowType to 'pkce' and turns
        // detectSessionInUrl ON by default, so ANY page that loads with
        // `?code=...` fires a browser-side POST /auth/v1/token?grant_type=pkce.
        // Landing on such a URL twice (reload, back/forward) re-sends a spent
        // code and 400s in the console while the user stays signed in.
        // `/auth/callback` is this app's only code-exchange point and it runs
        // server-side, so the browser must never attempt the exchange.
        detectSessionInUrl: false,
      },
    }
  )
}
