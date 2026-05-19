# PropCopilot

AI meeting intelligence and proposal generator. Joins video meetings via Recall.ai, transcribes in real time, gives question suggestions, and generates structured proposals after the meeting.

## Stack
- Next.js 16 (App Router) + TypeScript
- shadcn/ui + Tailwind CSS (Apple-style minimal)
- Supabase (auth, postgres, realtime)
- Recall.ai (meeting bots)
- Anthropic Claude claude-sonnet-4-6 (suggestions + proposal generation)
- Tiptap (rich text proposal editor)

## Setup

1. Copy `.env.example` to `.env.local` and fill in credentials
2. Apply all migrations in `supabase/migrations/` in order
3. Enable Supabase Realtime on `transcript_segments`, `suggestions`, `meetings`, `live_meeting_chat` (handled by `002_enable_realtime.sql`)
4. For local development, use ngrok to expose port 3000 for Recall.ai webhooks
5. Set `NEXT_PUBLIC_APP_URL` to your ngrok URL when testing webhooks

## Deployment (Vercel)

Production hosting: Vercel, auto-deploy from `main`.

- Env vars live in Vercel project settings → Environment Variables. `.env.example` lists every required name.
- `NEXT_PUBLIC_APP_URL` **must** equal the public Vercel URL (or custom domain). Recall.ai webhook URLs are built from this value at bot-creation time in `lib/recall.ts:53` — if it's wrong, webhooks land somewhere else and transcripts never save.
- Supabase migrations are **not** applied automatically. Run each new migration via Supabase dashboard → SQL Editor (or `supabase db push` via the CLI) against the production project before deploying code that depends on it.
- Supabase Auth → URL Configuration must include the Vercel URL as the Site URL and in the redirect allow-list, or the auth callback (`app/(auth)/auth/callback/route.ts`) will reject magic links.

## Run dev server
```
node node_modules/next/dist/bin/next dev
```
Note: due to spaces in the directory name, npm `.bin` symlinks don't work — use `node node_modules/...` directly.

## Architecture

```
Recall.ai → POST /api/webhooks/recall → save transcript_segments → generate suggestions
Browser → Supabase Realtime → live transcript + suggestions panels
Post-meeting → /api/meetings/[id]/proposal/chat → streaming Claude Q&A → proposal generation
```

## Key files
- `lib/recall.ts` — Recall.ai API wrapper
- `lib/claude.ts` — Anthropic SDK, suggestion + proposal generation
- `lib/supabase/` — browser + server + service clients
- `proxy.ts` — auth guard (Next.js 16 proxy convention)
- `app/api/webhooks/recall/route.ts` — main webhook handler
- `components/meeting/` — TranscriptPanel, SuggestionsPanel
- `components/proposal/` — PostMeetingChat, ProposalEditor
