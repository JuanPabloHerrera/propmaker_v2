# Deploying PropMaker to Vercel

This app is a standard Next.js 16 (App Router) project. Vercel auto-detects the
framework — no `vercel.json` is required. Deploy via the GitHub integration:
push to `main`, connect the repo in Vercel, and Vercel builds + deploys on every
push to `main`.

The repository root **is** the Next.js app root, so leave Vercel's **Root
Directory** at the default (`./`).

## 1. Connect the repo

1. Vercel dashboard → **Add New… → Project** → import
   `JuanPabloHerrera/propmaker_v2`.
2. Framework preset: **Next.js** (auto-detected). Build command `next build` and
   output are auto-configured. Do not override.
3. Node.js version: the default (Node 22.x) is fine for Next 16.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Set these for **Production** (and Preview, if you want preview deploys to work).
Values are NOT in the repo — `.env.local` is gitignored. Source them from the
dashboards listed in [.env.example](.env.example).

| Variable | Required | Type | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | public | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **secret** | Supabase → Settings → API (service role). Server-only; never exposed to the browser. |
| `ANTHROPIC_API_KEY` | ✅ | **secret** | console.anthropic.com — suggestions, Q&A, proposal generation |
| `DEEPGRAM_API_KEY` | ✅ | **secret** | console.deepgram.com — browser live-transcription token endpoint |
| `NEXT_PUBLIC_APP_URL` | ✅ | public | **Must equal the deployed URL exactly**, no trailing slash (e.g. `https://propmaker-v2.vercel.app` or a custom domain). Used for password-reset redirects and Recall.ai webhook URLs. |
| `RECALL_AI_API_KEY` | optional | **secret** | Only if using the Recall.ai bot capture path |
| `RECALL_AI_REGION` | optional | public | Defaults to `us-west-2` |

> `NEXT_PUBLIC_APP_URL` chicken-and-egg: on the first deploy you won't know the
> URL yet. Deploy once, copy the assigned domain, set `NEXT_PUBLIC_APP_URL` to
> it, then redeploy so the value is baked into the client bundle.

## 3. Supabase setup (one-time, against the production project)

Migrations are **not** applied automatically. In Supabase → **SQL Editor**, run
each file in [supabase/migrations/](supabase/migrations/) in order:

```
001_initial.sql
002_enable_realtime.sql
003_live_meeting_chat.sql
004_granola_pivot.sql
005_design_pivot.sql        ← user_profiles, attendee/context/deal columns, sharing
006_user_logo.sql           ← user_profiles.logo_url + user-logos Storage bucket
007_share_open_tracking.sql ← proposal open tracking
008_realtime_live_chat.sql  ← adds live_meeting_chat to the Realtime publication
009_fix_signup_trigger.sql  ← pins create_user_profile() search_path (fixes signup 500)
010_live_partial.sql        ← meetings.live_partial for real-time bot transcript
```

Then:

- **Realtime** — enable on `transcript_segments`, `suggestions`, `meetings`,
  `live_meeting_chat` (Database → Replication / Realtime).
- **Auth → URL Configuration** —
  - **Site URL** = your Vercel URL (matches `NEXT_PUBLIC_APP_URL`).
  - **Redirect URLs** allow-list: add `https://<your-vercel-url>/auth/callback`.

## 4. Deploy

Push to `main` (or click **Deploy** in Vercel). The build is verified green
locally (`next build`, 20 routes, 0 errors). After the first deploy, complete the
`NEXT_PUBLIC_APP_URL` + Supabase Auth URL steps above and redeploy.

## Smoke test after deploy

- `https://<url>/` → redirects to `/sign-in` (auth guard in [proxy.ts](proxy.ts)).
- Sign up → confirmation email → `/auth/callback` → onboarding `/welcome`.
- Public proposal route `/p/[slug]` loads without a session.
