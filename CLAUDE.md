# PropMaker

Mac-app-style AI meeting intelligence + document generator. The user joins a meeting instantly (local mic via Deepgram streaming, or an online meeting the Recall.ai bot joins from a pasted link), sees a live transcript + notes pad + AI co-pilot during the call, and afterwards lands on a per-meeting **documents hub** where they generate any of four editable documents — **meeting minute, transcript summary, proposal, or notes document (AI-polished from only the user's notes)** — as many as they want, any time. Notes stay editable on the hub after the meeting and feed every generator as authoritative context. Meeting title, client, attendees, context, and language are auto-extracted from the transcript (no pre-meeting form, no post-meeting Q&A, no brief review). Apple Liquid Glass aesthetic, sage-green accent, warm off-white canvas.

## Stack
- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind v4 (via `@import "tailwindcss"` in `app/globals.css`) + shadcn/ui (Base UI primitives)
- Geist + Geist Mono via `next/font/google` (bound to `--font-geist-sans` / `--font-geist-mono`)
- Supabase (auth, postgres, realtime)
- Deepgram streaming WebSocket — browser-side audio capture (local-mic meetings)
- Recall.ai — meeting bot (online meetings)
- Anthropic Claude `claude-sonnet-5` — every LLM call: suggestions, metadata extraction, reference matching, minute/summary/notes/proposal generation, refine, and the agent-bridge exports (with prompt caching on catalog + system blocks)
- Tiptap — notes pad (live page + documents hub card, with formatting toolbar) + document editor (all doc types)

## Setup

1. Copy `.env.example` to `.env.local` and fill in credentials
2. Apply all migrations in `supabase/migrations/` in order (the instant-join/documents pivot is **`016`–`019`**, with **`020_cleanup.sql`** applied only after the cutover deploy is verified — see each file's header; **`021`** adds the `notes` doc type and must be applied before deploying that generator)
3. Enable Supabase Realtime on `transcript_segments`, `suggestions`, `meetings`, `live_meeting_chat`, `deck_exports`
4. Recall.ai powers online meetings. For local testing of the bot path, use ngrok to expose port 3000 and set `NEXT_PUBLIC_APP_URL` to the ngrok URL.

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

## App flow (mirrors the instant-join pivot)

```
01 Onboarding         /welcome                     (auth group, no sidebar)
02 Profile            /profile
03 Resources          /resources                   (Services + Reference files, stacked)
04 Dashboard          /
05 Instant join       /meetings/new                (mode picker only: Local mic | Online link)
05b Upload meeting    /meetings/upload             (file or pasted transcript → straight to the hub)
06 Active meeting     /meetings/[id]/live
07 Processing         /meetings/[id]/processing
08 Documents hub      /meetings/[id]/documents     (generate minute / summary / proposal / notes + edit metadata + edit meeting notes)
09 Document editor    /meetings/[id]/documents/[docId]
10 Export & share     /meetings/[id]/documents/[docId]/share
   Public view        /p/[slug]                    (no auth, all doc types)
   Legacy redirect    /meetings/[id]/proposal → newest proposal doc (or the hub)
```

The dashboard layout gates onboarding: if `user_profiles.onboarded_at IS NULL`, redirects to `/welcome`.

## Architecture

```
Local-mic meeting ("browser")
  useMicCapture (getUserMedia → Deepgram streaming WebSocket)
    → transcript_segments INSERT (source='browser')
    → Supabase Realtime → live transcript panel

Online meeting ("recall")
  /meetings/new POSTs { mode:'online', meeting_url } → POST /api/meetings/[id]/bot → Recall.ai
    → POST /api/webhooks/recall
    → transcript_segments INSERT (source='recall')

Uploaded meeting ("upload")
  /meetings/upload POSTs multipart (file or pasted_text) → POST /api/meetings/upload
    → extracts text (PDF via Claude, DOCX via mammoth, TXT/MD decoded; ≤150k chars)
    → meetings INSERT (status='completed', capture_mode='upload')
    → transcript_segments INSERT (source='upload', one segment, treated as primary
      alongside 'browser' in gatherMeetingInputs + runMeetingExtraction)
    → redirect straight to the documents hub (its on-mount extract fills metadata)

Active meeting layout
  MeetingToolbar (top: back, title + REC pill, sidebar seg, attendees, mic, end)
  Transcript (left, collapsible) · NotesPad center · LiveChatPanel (right, collapsible)

End meeting → /processing → /documents (hub)
  Metadata extraction (lib/extract-meeting.runMeetingExtraction, guarded by
  meetings.metadata_extracted_at) fills title/client_company/attendees/context/language
  from the transcript. Triggered from: meeting PATCH status='completed' (browser),
  the Recall transcript.done webhook, and the processing screen's fallback POST
  /api/meetings/[id]/extract.

  The hub's generator cards POST /api/meetings/[id]/documents { type } — each click
  inserts a NEW meeting_documents row (multiple docs per meeting, any type, any time):
    · minute  → generateMeetingMinute (transcript + notes + live co-pilot artifacts)
    · summary → generateTranscriptSummary (transcript + notes)
    · proposal → matchReferenceProposal picks the single most similar past reference
      (LLM over stored summaries), then generateProposal runs SINGLE-PASS with blend
      authority: unit prices ONLY from the live catalog; the matched reference's
      full_text drives scope structure, timelines, and service packaging.
    · notes   → generateNotesDocument (ONLY the user's notes — polished/structured,
      no transcript; 422 if the meeting has no notes)
  All documents are generated in the meeting's detected language and open in the same
  Tiptap editor (refine via /api/documents/[id]/refine, autosave via PATCH
  /api/documents/[id], share via /api/documents/[id]/share).
  Inputs come from lib/meeting-inputs.gatherMeetingInputs (full active catalog — no
  per-meeting product filters anymore).
```

## Data model (current)

- `user_profiles` — onboarding gate (`onboarded_at`), brand fields (company_name, tagline, website, industry, voice_tones[], tone_prompt, signature_name, signature_title, brand_colors[], logo_url). Auto-created on auth signup.
- `meetings` — `capture_mode ('browser'|'recall'|'both'|'upload')`, `notes_json jsonb`, `attendees jsonb`, `context_summary`, `client_company`, `deal_status` (`draft|proposal_sent|won|lost`; `upcoming` legacy-only), `live_partial`, `recall_transcript_ready`, **`language`** + **`metadata_extracted_at`** (migration **`016`**). Deprecated (dropped in `020`): scheduled_at, selected_categories, attached/detected_product_ids, client_value, proposal_brief.
- `transcript_segments` — `source ('browser'|'recall'|'upload')`; 'upload' ranks with 'browser' as primary
- `products` — id, user_id, name, category, description, price_amount, price_unit, currency, notes, active
- **`meeting_documents`** (renamed from `proposals`, migration **`017`**) — `+doc_type ('minute'|'summary'|'proposal'|'notes')` (notes added in migration **`021`**), `+title`, `+language`, content_json, status, public_slug, shared_at, open tracking. Multiple rows per meeting.
- `reference_proposals` — summary (matching) + **`full_text`** (migration **`018`**, injected for the matched reference; null for legacy uploads — matching falls back to summary).
- `deck_exports` — `+format ('pptx'|'docx'|'pdf')`, `proposal_id`→`document_id` (migration **`019`**); one row per export job.
- `proposal_shares` — proposal_id (FK → meeting_documents), recipient_email, sent_at, opened_at, message_body
- **`user_credits`** (migration **`022`**) — one row per user: `balance` (CHECK ≥ 0), `stripe_customer_id`, `stripe_subscription_id`, `plan_id`, `subscription_status`. Read-only to clients (SELECT-own RLS); ALL writes via SECURITY DEFINER RPCs `spend_credits()` / `grant_credits()` (service role only). Deliberately NOT a column on `user_profiles` — its FOR ALL RLS would make it client-writable. 200 free credits on signup (trigger) + backfill.
- **`credit_transactions`** (migration **`022`**) — ledger: `type ('grant'|'purchase'|'subscription_grant'|'spend'|'refund')`, signed `amount`, `balance_after`, `stripe_event_id` (unique partial index = webhook idempotency).

## Key files
- `lib/claude.ts` — Anthropic SDK; `extractMeetingMetadata` (transcript → title/client/attendees/context/language), `matchReferenceProposal` (most-similar past reference), `generateMeetingMinute`, `generateTranscriptSummary`, `generateProposal` (single-pass, matched-reference + catalog blend), `generateNotesDocument` (notes-only polish), `streamDocumentRefine` (doc-type-aware), `generateSuggestions`, `streamLiveChat`, reference summarizers + `extractReferencePdfText`
- `lib/meeting-inputs.ts` — `gatherMeetingInputs()`: single source of truth for the transcript/notes/catalog/references/live-chat/metadata bundle shared by every generation route
- `lib/extract-meeting.ts` — `runMeetingExtraction()` (idempotent post-meeting metadata extraction) + `isPlaceholderTitle()`
- `lib/document-export.ts` — `runDocumentExport()`: the Claude agent-bridge export worker for pptx/docx/pdf (code-execution + skills; pptx falls back to `lib/pptx.ts`)
- `app/api/meetings/[id]/documents/route.ts` — GET list + POST generate (minute/summary/proposal → new `meeting_documents` row)
- `app/api/documents/[id]/{route,refine/route,share/route,export/route,export/download/route}.ts` — document CRUD/autosave, refine stream, share-link mint, export job start/poll
- `app/api/meetings/[id]/extract/route.ts` — extraction fallback trigger (processing screen)
- `app/(dashboard)/meetings/[id]/documents/page.tsx` + `components/documents/ClientMetaCard.tsx` — the documents hub
- `app/(dashboard)/meetings/[id]/documents/[docId]/{page,share/page}.tsx` — generalized editor + share (all doc types)
- `lib/tiptap.ts` — Tiptap JSON → plain text walker
- `lib/recall.ts` — Recall.ai wrapper (bot path; `meeting_metadata.title` read best-effort)
- `lib/sidebar.ts` — `getSidebarCounts()` server helper (counts `meeting_documents`; includes `credits` balance for the sidebar pill)
- `lib/billing/plans.ts` — **credits config, single source of truth**: `DOCUMENT_CREDIT_COST = 97`, `SIGNUP_GRANT = 200` (mirrored in migration 022's trigger), the 4 monthly PLANS ($17/200cr, $67/800cr, $107/1,300cr, $197/2,440cr — ~59–62% margin at worst-case COGS, above the 45% floor) + 4 one-time PACKS that mirror them exactly (same price, same credits, granted once). Stripe price ids come from env — 8 prices total, since a recurring price id can't be reused for a one-time checkout.
- `lib/billing/stripe.ts` — Stripe singleton + `getOrCreateStripeCustomer()`
- `app/api/billing/checkout/route.ts` — Checkout Session (plans = mode:subscription, packs = mode:payment)
- `app/api/webhooks/stripe/route.ts` — grants credits: packs on `checkout.session.completed` (mode=payment), subscriptions on `invoice.paid` ONLY (never both — avoids first-month double-grant); idempotent per `stripe_event_id`
- `app/api/credits/route.ts` — GET balance + recent ledger
- `app/(dashboard)/billing/page.tsx` + `components/billing/` — balance card, pricing, transactions, `InsufficientCreditsModal` (shown on 402 from the documents hub)
- `lib/supabase/` — browser + server + service clients
- `proxy.ts` — auth guard
- `app/globals.css` — design tokens (sage `--accent-base #4d8a6b`, warm canvas, `.glass` recipes, `.doc` typography, chrome utilities)
- `app/layout.tsx` — Geist sans + mono via `next/font`
- `app/(dashboard)/layout.tsx` — onboarding gate + `PMSidebar`
- `app/(auth)/welcome/page.tsx` — onboarding
- `app/p/[slug]/page.tsx` — public document view (no auth, RLS via `public_slug IS NOT NULL`, all doc types)
- `app/api/webhooks/recall/route.ts` — tags inserts as `source='recall'`; triggers extraction on transcript.done
- `app/api/profile/route.ts`, `app/api/profile/onboard/route.ts` — profile + onboarding
- `components/layout/PMSidebar.tsx` — Workspace + Library sections, counts via `getSidebarCounts`
- `components/ui/{icon,pill,avatar-initials,wave,glass-card,segmented,aurora-orb,checklist}.tsx` — design primitives
- `components/meeting/{MeetingToolbar,TranscriptPanel,NotesPad,NotesToolbar,LiveChatPanel,CollapsiblePanel,AudioCaptureButton,useMicCapture}.tsx` — active meeting (NotesPad has `variant='live'|'card'`, formatting toolbar, save-status footer, keepalive flush on unmount)
- `components/proposal/{OutlineSidebar,ProposalToolbar,ProposalEditor,SignatureBlock,RefineDrawer,TranscriptDrawer}.tsx` — document editor (all doc types; components take `documentId`)
- `components/share/{ProposalThumbnail,ShareLinkCard,RecipientsCard,ExportActions}.tsx` — share/export (Word + PDF + PowerPoint via the agent bridge)

## Important conventions

- **Spanish-language Deepgram config** is intentional (Mexican user). `language: 'es'` in `useMicCapture.ts` must survive refactors. (Document language is still detected per meeting — `meetings.language` — and generation follows it; only local-mic *transcription* is pinned to Spanish.)
- **Sage accent** — `--accent-base: #4d8a6b`. Never reintroduce the violet `#7c4cf0` from the design's bundle source; the project's canonical accent is sage.
- **Liquid Glass** — `.glass` (40px blur, 180% saturate) / `.glass-strong` (60px blur, 200%) / `.glass-soft`. The `.lg-shell` class provides the gradient backdrop. Cards use `.card` / `.card-accent`.
- **Apple Liquid Glass typography** — `.doc` for proposal + notes (Tiptap content gets `class="doc"`), `.pm-eyebrow` for section labels (mono, 10.5px, uppercase, tracking-wide), `.pm-h1` for page titles, `.mono-num` for tabular numerics.
- **Onboarding gate** — `app/(dashboard)/layout.tsx` redirects to `/welcome` when `user_profiles.onboarded_at IS NULL`. Skipping calls `POST /api/profile/onboard`.
- **Prompt caching** — the generators cache the static instructions and catalog blocks via `cache_control: { type: 'ephemeral' }`. Don't make those blocks dynamic per-call: the language directive and the matched-reference text live in the per-call USER content, never in the cached system blocks.
- **Transcript source partitioning** — never delete `transcript_segments` without filtering on `source`; the webhook and sync routes only delete `source='recall'` rows so the browser-captured stream is preserved.
- **Print stylesheet** — `@media print` in `globals.css` flattens glass + drops sidebar/toolbars. Use `.pm-no-print` on any UI chrome that shouldn't appear in PDF exports. Share screen offers `window.print()` via the public `/p/[slug]?print=1` route.
- **Post-meeting routes** — Active meeting `endMeeting` redirects to `/processing`; Processing auto-advances to `/documents` (the hub) and fires the extraction fallback; generator cards create documents and open them at `/documents/[docId]`; the editor toolbar's Share button goes to `/documents/[docId]/share`. `/meetings/[id]/proposal` survives only as a redirect for old bookmarks.
- **Metadata extraction idempotency** — `runMeetingExtraction` claims `meetings.metadata_extracted_at` before calling Claude; it is safe to trigger from the PATCH, webhook, and processing paths simultaneously. It never overwrites fields the user already filled (title only replaced while still a placeholder).

## Branded exports (agent bridge)

**Every in-product file export** (Word `.docx`, PDF, PowerPoint `.pptx` — for all doc types) runs through the **Claude agent bridge**: `lib/document-export.ts` `runDocumentExport()` executes Claude (`claude-sonnet-5`; set `PPTX_SKILL_MODEL=claude-opus-4-8` to roll back to the Opus tier) with the built-in document skill for the format (`pptx` / `docx` / `pdf`) inside a code-execution container (betas `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`), branded from `user_profiles` (colors/logo/signature) and written in the document's `language`. Jobs live in `deck_exports` (Realtime-enabled; polled via `/api/documents/[id]/export/download`), output lands in the private `generated-decks` bucket at `{user_id}/{job_id}.{ext}`.

- **PPTX proposals** additionally load the custom **`pptx-proposal-deck`** skill (`.claude/skills/pptx-proposal-deck/`, id in `ANTHROPIC_PPTX_SKILL_ID`; re-register with `scripts/register-pptx-skill.ts` after editing): Mode A reproduces an uploaded brand template on every slide, Mode B designs from the profile brand. Its narrative input is the **proposal document itself** (`references/propmaker-narrative-map.md` maps the 6 sections → slides; one detail slide per *Priorities & Key Deliverables* bullet — the old `ProposalBrief` no longer exists). No prices in the deck.
- **Fallbacks:** pptx falls back to the instant pptxgenjs deck (`lib/pptx.ts`, also available directly via GET `/api/documents/[id]/export`); docx/pdf jobs fail cleanly and the client offers `/p/[slug]?print=1` as the manual PDF escape hatch.
- The Claude Code cloud skill workflow (driven by the `pptx-proposal-generator` subagent) remains available for hand-driven, highest-fidelity decks.
