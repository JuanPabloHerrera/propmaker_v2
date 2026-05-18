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

1. Fill in `.env.local` with your credentials
2. Run the Supabase migration: `supabase/migrations/001_initial.sql`
3. Enable Supabase Realtime on `transcript_segments` and `suggestions` tables
4. For local development, use ngrok to expose port 3000 for Recall.ai webhooks
5. Set `NEXT_PUBLIC_APP_URL` to your ngrok URL when testing webhooks

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
