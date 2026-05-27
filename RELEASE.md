# PropCopilot — completion release (May 2026)

13 commits across a 14-iteration completion loop. Production build green
(`npm run build` succeeds, 20 routes prerendered/SSR'd). Every change pushed
to `origin/main` as it shipped.

## Database migrations (apply before deploy)

Two new SQL files; both need manual application via the Supabase SQL Editor
since the project's Supabase MCP isn't connected to this project:

1. [supabase/migrations/006_user_logo.sql](supabase/migrations/006_user_logo.sql)
   - `user_profiles.logo_url`
   - `user-logos` Storage bucket (public read, per-user-folder write)
   - public-read RLS on `user_profiles` gated on having a shared proposal
2. [supabase/migrations/007_share_open_tracking.sql](supabase/migrations/007_share_open_tracking.sql)
   - `proposals.first_opened_at`, `proposals.open_count`

Without these, the logo + open-tracking features are no-ops — the UI
won't crash, just won't have data.

## Shipped features

### Auth + profile (Tier A)
- **A1** — Forgot-password flow ([47c9e75](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/47c9e75)).
  `/forgot-password` requests Supabase recovery email; `/reset-password`
  validates the recovery session and updates the password.
  Sign-in page now links "Forgot password?". Proxy allowlist updated to
  pass through both routes for both unauthenticated and recovery-session
  users.
- **A2** — Company logo upload ([4d62d29](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/4d62d29)).
  Drag-and-drop or click-to-pick on the profile screen.
  `POST/DELETE /api/profile/logo` writes to Supabase Storage
  `user-logos/<uid>/logo-<ts>.<ext>`, cleans up stale logos, returns
  the public URL. `SignatureBlock` renders the logo (object-fit
  contain) in place of the initials avatar on both the editable
  proposal page and the public `/p/[slug]` view.
- **A3** — Brand colors applied to proposal ([1f525b8](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/1f525b8)).
  [lib/brand.ts](lib/brand.ts) maps `brand_colors[]` slots to scoped CSS
  vars (`--ink-1`, `--accent-base`, etc.) on `.proposal-paper` via
  `color-mix()` derivations. Live preview card on the BrandPalette
  updates as the user picks. Print stylesheet inherits the same vars
  so the PDF export matches.

### AI / pipeline depth (Tier B)
- **B1** — Real proposal-refine chat ([9936115](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/9936115)).
  Right-side glass drawer with focus trap + Escape close + focus
  restore. Two streaming modes via
  `POST /api/meetings/[id]/proposal/refine`: `chat` (3-6 sentence
  suggestions, no doc edit) and `apply` (full Markdown rewrite that
  persists to `content_json`). Reuses the prompt-cached
  catalog + current-proposal blocks. Killed the
  "Refine flow coming soon" stub.
- **B2** — `detected_product_ids` end-to-end ([9fe41dd](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/9fe41dd)).
  `POST /api/meetings/[id]/detect-products` asks Claude (Sonnet, JSON
  output) which catalog products appear in the transcript, persists
  IDs to the meeting, returns the matched rows. `DetectedProductsCard`
  on Q&A auto-runs detection, lets the user Add (moves to
  `attached_product_ids`) or Dismiss. The chat + refine routes now
  union `selected_categories` ∪ `attached_product_ids` ∪
  `detected_product_ids` so explicit picks always reach the model.
- **B3** — Smarter `deal_status` auto-transitions ([e1b6b59](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/e1b6b59)).
  First share mints a slug AND bumps `meeting.deal_status` →
  `proposal_sent` (guarded so won/lost terminal states stick). `/p/[slug]`
  renders a tiny `<RecordOpen>` client component that fires once per
  session to `POST /api/p/[slug]/open` (service-role); this bumps
  `proposals.open_count` and sets `first_opened_at` on the first call.
  Share screen now displays "Opened N× · first 5m ago" or
  "Not opened yet". Dashboard table shows an "Overdue" eyebrow on
  upcoming meetings whose `scheduled_at` has passed.

### Polish + a11y (Tier D)
- **D1** — Skeleton loaders ([d860bd5](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/d860bd5))
  with shape-matched layouts on dashboard, profile, proposal, share,
  QA, and live pages; respects `prefers-reduced-motion`.
- **D2** — `error.tsx` boundaries for (dashboard), (auth),
  meetings/[id], /p/[slug], plus `/p/[slug]/not-found.tsx`
  ([49c4cf9](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/49c4cf9)).
- **D3** — `<FieldError/>` primitive + validation on the new-meeting
  form (title, scheduled_at, meeting URL) with `aria-invalid` +
  `aria-describedby` + first-error focus ([570da27](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/570da27)).
- **D4** — Skip-to-content link + consistent sage `:focus-visible`
  ring on every interactive element via `@layer base`
  ([92b1653](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/92b1653)).
- **D5** — Sidebar `<nav aria-label>` landmarks + `aria-current="page"`
  on active links ([dc95713](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/dc95713)). Audit confirmed all icon-only
  buttons already had `aria-label` and the `<Icon/>` primitive
  defaults to `aria-hidden`.
- **D6** — WCAG AA pass on text tokens ([582fcc0](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/582fcc0)).
  `--ink-3` darkened 3.03 → 4.90, `--rec` darkened, added
  `--accent-strong` (5.01 on cream) and `--warn-strong` (4.25)
  reserved for text. Pill variants + MeetingStatusMenu use the new
  strong tokens. `--ink-4` documented as decorative-only.
- **D7** — Optimistic UI on proposal Draft/Final toggle
  ([9172b52](https://github.com/JuanPabloHerrera/propcopilot_v1/commit/9172b52)).
  (MeetingStatusMenu + DetectedProductsCard already optimistic from
  earlier iterations.)

## Out of scope (per kickoff Q&A)

- Calendar onboarding, Google Docs export, Notion export — still
  "coming soon" toasts; require OAuth which was scoped out.
- Real email sending — `proposal_shares` rows still preview-only;
  needs Resend or similar API key.
- Mobile responsive layout — desktop-only retained.

## Test plan

1. Apply migrations 006 + 007.
2. Sign up → onboard → land on dashboard.
3. Profile → upload a logo, pick brand colors, save. Verify logo +
   accent on a proposal page.
4. New meeting → live → end → processing → QA. Confirm
   DetectedProductsCard renders + Add/Dismiss works.
5. Generate proposal → click Refine → ask for an edit → Apply →
   verify editor content updates.
6. Mark proposal Final → check optimistic flip → share. Verify
   `deal_status` becomes "proposal_sent" on the dashboard.
7. Open `/p/<slug>` in an incognito window → return to share
   screen → "Opened 1× · first just now" appears.
8. Tab through the dashboard from sign-in: skip link → main →
   sidebar order is correct, focus rings visible.
9. Run a Lighthouse a11y scan on `/` and `/p/<slug>` — should
   score 95+.
