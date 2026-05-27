# PropMaker

Mac-app-style AI meeting intelligence + proposal generator. Captures audio in the browser (Deepgram streaming), shows a live transcript + notes pad + AI co-pilot during the call, and after the meeting walks the user through Processing → Q&A → Proposal → Share. Apple Liquid Glass aesthetic, sage-green accent, warm off-white canvas. Recall.ai is supported as a secondary, opt-in transcript source.

## Stack
- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind v4 (via `@import "tailwindcss"` in `app/globals.css`) + shadcn/ui (Base UI primitives)
- Geist + Geist Mono via `next/font/google` (bound to `--font-geist-sans` / `--font-geist-mono`)
- Supabase (auth, postgres, realtime)
- Deepgram streaming WebSocket — browser-side audio capture (primary)
- Recall.ai — meeting bot (secondary fallback transcript)
- Anthropic Claude `claude-sonnet-4-6` — suggestions, post-meeting Q&A, proposal generation (with prompt caching on catalog + system blocks)
- Tiptap — notes pad + proposal editor

## Setup

1. Copy `.env.example` to `.env.local` and fill in credentials
2. Apply all migrations in `supabase/migrations/` in order (including **`005_design_pivot.sql`** for the redesign — adds `user_profiles`, attendee/context/deal columns on meetings, and proposal sharing)
3. Enable Supabase Realtime on `transcript_segments`, `suggestions`, `meetings`, `live_meeting_chat`
4. Recall.ai is optional — only needed when a user opts into bot capture. For local testing of the bot path, use ngrok to expose port 3000 and set `NEXT_PUBLIC_APP_URL` to the ngrok URL.

## Deployment (Vercel)

Production hosting: Vercel, auto-deploy from `main`.

- Env vars live in Vercel project settings → Environment Variables. `.env.example` lists every required name.
- `NEXT_PUBLIC_APP_URL` **must** equal the public Vercel URL (or custom domain). Recall.ai webhook URLs are built from this value at bot-creation time in `lib/recall.ts`.
- Supabase migrations are **not** applied automatically. Run each new migration via Supabase dashboard → SQL Editor (or `supabase db push` via the CLI) against the production project before deploying code that depends on it.
- Supabase Auth → URL Configuration must include the Vercel URL as the Site URL and in the redirect allow-list.

## Run dev server
```
node node_modules/next/dist/bin/next dev
```
Note: due to spaces in the directory name, npm `.bin` symlinks don't work — use `node node_modules/...` directly.

## App flow (10 screens, mirrors `design/PropMaker.standalone.html`)

```
01 Onboarding         /welcome                     (auth group, no sidebar)
02 Profile            /profile
03 Catalog            /products
04 Dashboard          /
05 Pre-meeting        /meetings/new
06 Active meeting     /meetings/[id]/live
07 Processing         /meetings/[id]/processing    ← new
08 Agent Q&A          /meetings/[id]/qa            ← new (split from proposal)
09 Final proposal     /meetings/[id]/proposal
10 Export & share     /meetings/[id]/proposal/share ← new
   Public view        /p/[slug]                    ← new (no auth)
```

The dashboard layout gates onboarding: if `user_profiles.onboarded_at IS NULL`, redirects to `/welcome`.

## Architecture

```
Browser audio (primary)
  AudioCaptureButton (getDisplayMedia + mic)
    → Deepgram streaming WebSocket
    → transcript_segments INSERT (source='browser')
    → Supabase Realtime → live transcript panel

Recall.ai bot (optional fallback)
  POST /api/meetings/[id]/bot → Recall.ai
    → POST /api/webhooks/recall
    → transcript_segments INSERT (source='recall')

Active meeting layout
  MeetingToolbar (top: back, title + REC pill, sidebar seg, attendees, mic, end)
  Transcript (left, collapsible) · NotesPad center · LiveChatPanel (right, collapsible)

End meeting → /processing → /qa → /proposal → /proposal/share
  /api/meetings/[id]/proposal/chat handles both Q&A streaming AND proposal generation.
  On [READY_TO_GENERATE] or user "Generate now", generateProposal runs and the editor
  receives the markdown; user then redirects to /proposal.
```

## Data model (current)

- `user_profiles` (new) — onboarding gate (`onboarded_at`), brand fields (company_name, tagline, website, industry, voice_tones[], tone_prompt, signature_name, signature_title, brand_colors[]). Auto-created on auth signup.
- `meetings` — `+capture_mode`, `+selected_categories text[]`, `+notes_json jsonb`, `+attendees jsonb`, `+context_summary text`, `+client_company text`, `+client_value numeric`, `+attached_product_ids uuid[]`, `+detected_product_ids uuid[]`, `+deal_status` (`draft|proposal_sent|won|lost|upcoming`)
- `transcript_segments` — `+source ('browser'|'recall')`
- `products` — id, user_id, name, category, description, price_amount, price_unit, currency, notes, active
- `proposals` — `+public_slug text unique`, `+shared_at timestamptz`
- `proposal_shares` (new) — proposal_id, recipient_email, sent_at, opened_at, message_body

## Key files
- `lib/claude.ts` — Anthropic SDK; `generateProposal`, `streamPostMeetingChat` (prompt-cached)
- `lib/tiptap.ts` — Tiptap JSON → plain text walker
- `lib/recall.ts` — Recall.ai wrapper (optional bot path)
- `lib/sidebar.ts` — `getSidebarCounts()` server helper
- `lib/supabase/` — browser + server + service clients
- `proxy.ts` — auth guard
- `app/globals.css` — design tokens (sage `--accent-base #4d8a6b`, warm canvas, `.glass` recipes, `.doc` typography, chrome utilities)
- `app/layout.tsx` — Geist sans + mono via `next/font`
- `app/(dashboard)/layout.tsx` — onboarding gate + `PMSidebar`
- `app/(auth)/welcome/page.tsx` — onboarding
- `app/p/[slug]/page.tsx` — public proposal view (no auth, RLS via `public_slug IS NOT NULL`)
- `app/api/webhooks/recall/route.ts` — tags inserts as `source='recall'`
- `app/api/meetings/[id]/proposal/chat/route.ts` — Q&A + proposal generation pipeline
- `app/api/profile/route.ts`, `app/api/profile/onboard/route.ts` — profile + onboarding
- `app/api/proposals/[id]/share/route.ts` — share-link mint + `proposal_shares` rows
- `components/layout/PMSidebar.tsx` — Workspace + Library sections, counts via `getSidebarCounts`
- `components/ui/{icon,pill,avatar-initials,wave,glass-card,segmented,aurora-orb,checklist}.tsx` — design primitives
- `components/meeting/{MeetingToolbar,TranscriptPanel,NotesPad,LiveChatPanel,CollapsiblePanel,AudioCaptureButton}.tsx` — active meeting
- `components/meeting/{AttendeePillRow,CaptureMethodTiles,ContextTextarea,ProductAttachList,AgentSuggestionCard}.tsx` — pre-meeting
- `components/proposal/{OutlineSidebar,ProposalToolbar,ProposalEditor,SignatureBlock}.tsx` — proposal
- `components/qa/{QAToolbar,SingleQuestionView,QuickReplyChips}.tsx` — agent Q&A
- `components/share/{ProposalThumbnail,ShareLinkCard,RecipientsCard,ExportActions}.tsx` — share/export

## Important conventions

- **Spanish-language Deepgram config** is intentional (Mexican user). `language: 'es'` in `AudioCaptureButton.tsx` must survive refactors.
- **Sage accent** — `--accent-base: #4d8a6b`. Never reintroduce the violet `#7c4cf0` from the design's bundle source; the project's canonical accent is sage.
- **Liquid Glass** — `.glass` (40px blur, 180% saturate) / `.glass-strong` (60px blur, 200%) / `.glass-soft`. The `.lg-shell` class provides the gradient backdrop. Cards use `.card` / `.card-accent`.
- **Apple Liquid Glass typography** — `.doc` for proposal + notes (Tiptap content gets `class="doc"`), `.pm-eyebrow` for section labels (mono, 10.5px, uppercase, tracking-wide), `.pm-h1` for page titles, `.mono-num` for tabular numerics.
- **Onboarding gate** — `app/(dashboard)/layout.tsx` redirects to `/welcome` when `user_profiles.onboarded_at IS NULL`. Skipping calls `POST /api/profile/onboard`.
- **Prompt caching** — `generateProposal` and `streamPostMeetingChat` cache the static instructions and catalog blocks via `cache_control: { type: 'ephemeral' }`. Don't make those blocks dynamic per-call.
- **Transcript source partitioning** — never delete `transcript_segments` without filtering on `source`; the webhook and sync routes only delete `source='recall'` rows so the browser-captured stream is preserved.
- **Print stylesheet** — `@media print` in `globals.css` flattens glass + drops sidebar/toolbars. Use `.pm-no-print` on any UI chrome that shouldn't appear in PDF exports. Share screen offers `window.print()` via the public `/p/[slug]?print=1` route.
- **Post-meeting routes** — Active meeting `endMeeting` redirects to `/processing`; Processing auto-advances to `/qa`; Q&A "Generate now" advances to `/proposal`; Proposal toolbar Share button goes to `/proposal/share`.
