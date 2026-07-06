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

> **Working agreement — always ship.** As soon as a change is complete and the
> build is green, commit it and `git push origin main` to trigger the Vercel
> production deploy. Don't leave finished changes sitting uncommitted. The
> bottom-right **version pill** (`v{version} · {git sha}`, links to the commit on
> GitHub) shows the deployed commit SHA so you can confirm prod is on the latest
> push — see `components/ui/version-pill.tsx` + `NEXT_PUBLIC_GIT_SHA` in `next.config.ts`.

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
09 Proposal brief     /meetings/[id]/brief         ← new (prioritized synthesis, reviewed before generation)
10 Final proposal     /meetings/[id]/proposal
11 Export & share     /meetings/[id]/proposal/share ← new
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

End meeting → /processing → /qa → /brief → /proposal → /proposal/share
  /api/meetings/[id]/proposal/chat handles ONLY the post-meeting Q&A stream. On
  [READY_TO_GENERATE] or "Skip questions" it signals { toBrief: true } and the client
  advances to /brief. There, POST /api/meetings/[id]/brief runs generateMeetingBrief —
  a synthesis of every input (transcript, notes, Q&A, live co-pilot, catalog, references,
  and the pre-meeting context/attendee/client metadata) into a prioritized ProposalBrief
  persisted on meetings.proposal_brief. The consultant reviews/edits it (autosaved via
  PATCH /api/meetings/[id]); "Generate proposal" then POSTs the brief to
  /api/meetings/[id]/proposal/generate, which runs generateProposal with the brief as the
  highest-authority input and upserts the proposals row → redirect to /proposal.
  All three post-meeting routes gather their inputs via lib/meeting-inputs.gatherMeetingInputs.
```

## Data model (current)

- `user_profiles` (new) — onboarding gate (`onboarded_at`), brand fields (company_name, tagline, website, industry, voice_tones[], tone_prompt, signature_name, signature_title, brand_colors[]). Auto-created on auth signup.
- `meetings` — `+capture_mode`, `+selected_categories text[]`, `+notes_json jsonb`, `+attendees jsonb`, `+context_summary text`, `+client_company text`, `+client_value numeric`, `+attached_product_ids uuid[]`, `+detected_product_ids uuid[]`, `+deal_status` (`draft|proposal_sent|won|lost|upcoming`), `+proposal_brief jsonb` (reviewed pre-proposal synthesis, migration **`013`**)
- `transcript_segments` — `+source ('browser'|'recall')`
- `products` — id, user_id, name, category, description, price_amount, price_unit, currency, notes, active
- `proposals` — `+public_slug text unique`, `+shared_at timestamptz`
- `proposal_shares` (new) — proposal_id, recipient_email, sent_at, opened_at, message_body

## Key files
- `lib/claude.ts` — Anthropic SDK; `generateMeetingBrief` (pre-proposal synthesis → `ProposalBrief`), `generateProposal` (takes the reviewed brief as top-priority input; emits a `## Priorities & Key Deliverables` section), `streamPostMeetingChat` (all prompt-cached), plus `coerceBrief`/`emptyBrief` helpers
- `lib/meeting-inputs.ts` — `gatherMeetingInputs()`: single source of truth for the transcript/notes/catalog/references/Q&A/live-chat/context bundle shared by the chat, brief, and generate routes
- `app/api/meetings/[id]/brief/route.ts` — GET (read persisted brief) + POST (synthesize + persist)
- `app/api/meetings/[id]/proposal/generate/route.ts` — final proposal generation from the reviewed brief
- `app/(dashboard)/meetings/[id]/brief/page.tsx` + `components/brief/{BriefReview,BriefToolbar}.tsx` — the review/edit screen
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

## Branded PPTX proposals (skill + agent)

The **canonical way to produce a polished, branded `.pptx` deck** of a proposal is the Claude Code skill **`pptx-proposal-deck`** (`.claude/skills/pptx-proposal-deck/`), driven by the **`pptx-proposal-generator`** subagent (`.claude/agents/`). It runs in **Claude Code cloud** (needs `/mnt/skills/public/pptx`, LibreOffice, Poppler).

- **What it does:** takes the proposal narrative we already produce — primarily the reviewed **`ProposalBrief`** (`meetings.proposal_brief`), plus the generated proposal doc — and a **brand template `.pptx`**, and builds a B2B deck (portada → contexto/retos → necesidades citadas → quiénes somos → metodología → casos de uso → demo → seguridad → alcance → próximos pasos → cierre) via `scripts/build_deck.js` (pptxgenjs), with a mandatory visual + leftover-token QA loop. Spanish by default; **no prices** in the deck. **The slide count adapts to the content** — one detail slide per `ProposalBrief.priorities` entry and optional sections (`context`/`methodology`/`demo`/`security`/`scope`) omitted when the narrative doesn't support them (typically ~14).
- **The mix:** design/build = the skill; content = PropMaker's narrative (`references/propmaker-narrative-map.md` maps `ProposalBrief`/doc → slides). The agent edits only `BRAND` + `CONTENT` in `build_deck.js`; render code is QA-proven and untouched. `scripts/example_deck_gentera.js` is a worked example (reference only — the QA grep blocks any of its tokens leaking).
- **Unchanged by this:** `lib/claude.ts` (`generateProposal`/`generateMeetingBrief`) and the doc/Markdown→Tiptap pipeline stay as-is. The **serverless PPTX export** (`lib/pptx.ts` / `lib/pptx-template-fill.ts` via `app/api/proposals/[id]/export/pptx/route.ts`) also stays as the lightweight in-product download; the skill is the high-fidelity, agent-driven alternative.
