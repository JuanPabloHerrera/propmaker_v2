# PropMaker — Design System

> Mac-app-style AI meeting intelligence + proposal generator.
> **Aesthetic:** Apple "Liquid Glass" — warm off-white canvas, sage-green accent, heavy frosted-glass surfaces, hairline borders, and tight, optical-grade typography.

This document is the canonical reference for PropMaker's visual language. The source of truth lives in [`app/globals.css`](../app/globals.css); the visual prototype is [`design/PropMaker.standalone.html`](./PropMaker.standalone.html). Every token, recipe, and component class below is defined there.

---

## 1. Design Principles

1. **Liquid Glass first.** Surfaces are frosted, translucent, and refract the gradient backdrop behind them. Depth comes from blur + specular highlights, not heavy drop shadows.
2. **Warm, not white.** The canvas is a warm off-white cream (`#ebe6dd → #f4efe6`), never pure `#fff`. Pure white is reserved for popovers only.
3. **Sage is the one accent.** A single muted sage green (`#4d8a6b`) carries all brand emphasis. **Never** reintroduce the violet `#7c4cf0` from the original bundle.
4. **Hairlines over borders.** Dividers and edges are `0.5px` at very low opacity (`rgba(28,24,20,0.08)`). The UI reads light and precise, like macOS chrome.
5. **Optical typography.** Negative letter-spacing on headings, tabular numerics for figures, a mono face for eyebrows/labels/metadata. Geist + Geist Mono throughout.
6. **Quiet motion.** Subtle pulses, shimmers, and transitions only. All non-essential animation is killed under `prefers-reduced-motion`.

---

## 2. Color Tokens

All colors are CSS custom properties on `:root` in [`app/globals.css`](../app/globals.css). Reference them via `var(--token)` or the Tailwind theme mappings — never hardcode hex values in components.

### Ink (text) scale
| Token | Value | Use |
|---|---|---|
| `--ink-1` | `#1c1814` | Primary text, headings. AA on cream + white. |
| `--ink-2` | `#4a443d` | Secondary text, labels. AA on cream + white. |
| `--ink-3` | `#6b605a` | Tertiary / muted text, metadata. AA on cream + white. |
| `--ink-4` | `#b8b0a6` | **Decorative only** — placeholders, hairline text, watermarks. Fails AA for body. |

### Canvas & surfaces
| Token | Value | Use |
|---|---|---|
| `--bg-canvas` | `#ebe6dd` | Deepest canvas (gradient bottom). |
| `--bg-shell` | `#f4efe6` | App shell background (gradient top), mapped to `--background`. |
| `--glass-tint` | `rgba(255,251,244,0.55)` | Default glass fill. |
| `--glass-tint-strong` | `rgba(255,250,240,0.72)` | Strong glass fill (sidebars, toolbars). |
| `--glass-tint-soft` | `rgba(255,252,246,0.40)` | Subtle glass fill (nested panels). |

### Hairlines
| Token | Value | Use |
|---|---|---|
| `--line-1` | `rgba(28,24,20,0.08)` | Standard hairline (borders, dividers, inputs). |
| `--line-2` | `rgba(28,24,20,0.04)` | Faintest hairline. |

### Sage accent
| Token | Value | Use |
|---|---|---|
| `--accent-base` | `#4d8a6b` | **Brand color.** Icons, fills, borders, focus rings (3:1 OK). |
| `--accent-2` | `#6fa888` | Lighter sage — gradient tops, hover. |
| `--accent-strong` | `#356b51` | Darker sage — **inline text on cream/white** where AA 4.5:1 is required. |
| `--accent-soft` | `rgba(77,138,107,0.10)` | Tinted fills (selected, sidebar accent). |
| `--accent-glow` | `rgba(77,138,107,0.25)` | Glow / focus aura. |
| `--accent-tint` | `rgba(77,138,107,0.06)` | Faintest sage wash (card-accent bottom). |

> **Accent contrast rule:** use `--accent-base` for non-text (icons, fills, borders). For sage-colored *text* on a light surface, use `--accent-strong`.

### Status colors
| Token | Value | Use |
|---|---|---|
| `--rec` | `#b03434` | Recording / destructive / live REC dot. |
| `--rec-soft` | `rgba(176,52,52,0.10)` | Rec pill fill. |
| `--ok` | `#356b51` | Success (same as accent-strong). |
| `--warn` | `#c98a3a` | Warning fills/icons. |
| `--warn-strong` | `#8a5d20` | Warning **text** (AA). |
| `--warn-soft` | `rgba(201,138,58,0.12)` | Warn pill fill. |

### shadcn surface mapping
The shadcn/ui tokens are **re-mapped** onto the design tokens so primitives inherit the warm palette automatically:

```
--background → --bg-shell        --primary    → --ink-1 (near-black, NOT sage)
--foreground → --ink-1           --accent     → --accent-base
--card       → rgba(255,253,247,0.78)   --ring → --accent-base
--popover    → #ffffff (only pure white)  --border / --input → --line-1
--muted/--secondary → --bg-canvas  --destructive → oklch(0.577 0.245 27.325)
```

> Note: shadcn `--primary` is **ink** (near-black), not sage. The default `<Button>` is a dark high-contrast button; sage is applied selectively, not as the primary button fill.

---

## 3. Typography

**Fonts** ([`app/layout.tsx`](../app/layout.tsx)): Geist Sans (`--font-geist-sans`) and Geist Mono (`--font-geist-mono`), loaded via `next/font/google`. Both sans body and headings use Geist Sans; `--font-heading` aliases it.

**Body defaults** (`@layer base`):
- `font-feature-settings: 'ss01', 'cv11'` (stylistic alternates)
- `letter-spacing: -0.005em` body, `-0.01em` headings
- `-webkit-font-smoothing: antialiased`

### Type helpers
| Class | Spec | Use |
|---|---|---|
| `.pm-eyebrow` | Mono, 10.5px, 500, `tracking 0.06em`, uppercase, `--ink-3` | Section labels / kickers |
| `.pm-h1` | 22px / 600 / `-0.02em` / `--ink-1` | Page titles |
| `.mono-num` | Geist Mono, tabular-nums | Figures, prices, counts, timestamps |

### Document typography (`.doc`)
Applied to Tiptap-rendered content (proposals + notes pad). Self-contained type scale:

| Element | Spec |
|---|---|
| `.doc h1` | 28px / 600 / `-0.025em` |
| `.doc h2` | 16px / 600 / `-0.01em`, `22px` top margin |
| `.doc h3` | 13px / 600 / `--ink-2` |
| `.doc p`, `li` | 12.5px / line-height 1.6 |
| `.doc .lede` | 14px / `--ink-2` (intro paragraph) |
| `.doc table` | 12.5px, collapsed, `8px` radius, hairline grid, sage-tinted `th`, tabular-nums `td` |
| `.doc hr` | `0.5px` hairline, `18px` margin |

> Proposal pipe-tables render as real `<table>`s with a sage-tinted header row (`rgba(77,138,107,0.06)`).

---

## 4. Radius & Spacing

### Radius tokens
A single base `--radius: 0.75rem` (12px) drives the shadcn scale (`--radius-sm` … `--radius-4xl` = `0.6×` … `2.6×`). Component-specific radii:

| Token | Value | Use |
|---|---|---|
| `--r-window` / `--r-panel` | `14px` | Windows, glass panels |
| `--r-card` | `12px` | Cards |
| `--r-input` | `9px` | Form fields |
| `--r-pill` | `999px` | Pills, progress, dots |

### Density
PropMaker is a **dense, desktop-class** UI. Reference sizes from the component classes:
- Pills: `20px` tall, `10.5px` text
- Fields: `32px` tall, `12.5px` text
- Buttons (shadcn default): `h-8` (32px), `text-sm`
- Checkbox: `14px`
- Body copy in docs: `12.5px`

Keep new components in this compact register — this is a tool, not a marketing page.

---

## 5. Surface Recipes

### The shell — `.lg-shell`
The gradient backdrop the glass refracts against. Wrap the app root:
```css
radial-gradient(amber glow, top-right)
+ radial-gradient(sage glow, bottom-left)
+ linear-gradient(#f4efe6 → #ebe6dd)
```

### Glass primitives
| Class | Blur / Saturate | Use |
|---|---|---|
| `.glass` | `40px` / `180%` | Default panels |
| `.glass-strong` | `60px` / `200%` | Sidebars, toolbars (most opaque) |
| `.glass-soft` | `28px` / `160%`, `10px` radius | Nested / subtle panels |

All glass surfaces carry: a `0.5px rgba(255,255,255,0.65)` light border, a layered shadow (ambient + contact + two inset highlights), and `.glass`/`.glass-strong` add a `::before` **specular top-edge highlight** (`mix-blend-mode: overlay`) — the "wet" refraction.

### Cards
| Class | Recipe |
|---|---|
| `.card` | `rgba(255,253,247,0.78)`, `30px` blur, hairline border, soft shadow, `12px` radius |
| `.card-accent` | Sage gradient wash (`--accent-soft → --accent-tint`), sage-tinted border |

Component wrappers: [`GlassCard`](../components/ui/glass-card.tsx) (`as` + `accent` props → `.card` / `.card-accent`).

---

## 6. Component Catalog

Design primitives live in [`components/ui/`](../components/ui/). They are thin wrappers over the CSS classes above plus shadcn/Base UI primitives.

| Component | File | Notes |
|---|---|---|
| `Button` | `ui/button.tsx` | shadcn + Base UI. Variants: `default` (dark ink), `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes `xs/sm/default/lg` + icon. Active state nudges `translate-y-px`. |
| `Pill` | `ui/pill.tsx` | `.pill` + variants `default/accent/mono/ok/warn/rec`. 20px tall status chips. |
| `GlassCard` | `ui/glass-card.tsx` | `.card` / `.card-accent`. |
| `Segmented` | `ui/segmented.tsx` | `.seg` toggle control (active = white pill with inset highlight). |
| `Icon` | `ui/icon.tsx` | lucide-react wrapper. |
| `AvatarInitials` | `ui/avatar-initials.tsx` | Attendee avatars. |
| `Wave` | `ui/wave.tsx` | `.wave` audio waveform (sage bars). |
| `AuroraOrb` | `ui/aurora-orb.tsx` | Animated processing/ambient orb. |
| `Checklist` | `ui/checklist.tsx` | Mac-style `.cbox` checkboxes. |
| Field/Input/Textarea/Label | `ui/*` | `.field` recipe — 32px, hairline, sage focus ring (`0 0 0 3px var(--accent-soft)`). |
| Skeleton | `ui/skeleton.tsx` | `.pm-skeleton` shimmer (warm). |
| Sonner | `ui/sonner.tsx` | Toasts, bottom-right. |

### Inline UI element classes (CSS-only)
- **Pills** — `.pill` + `.pill-accent / -ok / -warn / -rec / -mono`
- **Dots** — `.dot`, `.dot-rec` (pulsing live indicator), `.live-pulse`
- **Segmented** — `.seg` / `.seg button.on`
- **Progress** — `.progress > i` (sage gradient fill, animated width)
- **Fields** — `.field`, `textarea.field`, `.field-label`
- **Checkbox** — `.cbox` / `.cbox.on` (sage gradient)
- **Transcript** — `.tx-line`, `.tx-meta`, `.tx-spk`, `.tx-body`
- **Chat bubbles** — `.bubble-ai` (cream, tail bottom-left), `.bubble-user` (sage gradient, tail bottom-right)
- **Typing indicator** — `.typing-dots > i` (3 bouncing sage-grey dots)
- **Hairline** — `.hairline` (0.5px divider)

---

## 7. Motion

| Animation | Trigger | Spec |
|---|---|---|
| `dot-pulse` | `.dot-rec` | Expanding ring, 1.6s — live REC indicator |
| `live-pulse` | `.live-pulse` | Opacity 1 ↔ 0.4, 1.5s |
| `pm-shimmer` | `.pm-skeleton::after` | Sweep, 1.4s — loading placeholders |
| `typing-bounce` | `.typing-dots > i` | Staggered (0 / .15 / .30s) — AI "thinking" |
| Field focus | `.field:focus` | 150ms border + 3px sage aura |
| Progress fill | `.progress > i` | `width 240ms ease-out` |

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables `.dot-rec`, `.live-pulse`, `.pm-skeleton::after`, `.typing-dots`.

---

## 8. Accessibility

- **Contrast:** `--ink-1/2/3` all clear AA (4.5:1+) on cream and white. `--ink-4` is decorative-only. For sage text use `--accent-strong`; for warning text use `--warn-strong`.
- **Focus rings:** Tailwind base sets a quiet `outline-ring/50` on all elements; this is overridden so a **2px sage outline** (`--accent-base`, 2px offset) appears only on keyboard-focused interactive elements (`:focus-visible`). Mouse focus stays clean. Pills/dropdown triggers get a pill-shaped (999px) ring.
- **Skip link:** `.pm-skip-link` — first focusable element on the dashboard layout; slides in on focus to jump past the sidebar to main content.
- **Scrollbars:** `.lg-shell` scopes minimal 6px Mac-style scrollbars.

---

## 9. Print / PDF Export

Proposals export via `window.print()` (public `/p/[slug]?print=1`). The `@media print` block in [`app/globals.css`](../app/globals.css):
- `@page` Letter, 0.5in margins; forces white background with `print-color-adjust: exact` (keeps sage tints + warm accents).
- Flattens chrome: `.lg-shell` → white, glass blur/shadows stripped, `.pm-no-print` hidden.
- `.proposal-paper` goes full-bleed on a clean white sheet (drops the floating-card affordances).
- Keeps headings with content: `.doc h1/h2/h3 { break-after: avoid-page }`.

> Add `.pm-no-print` to any UI chrome (toolbars, sidebar) that must not appear in exports.

---

## 10. Conventions & Guardrails

- **Sage only.** `--accent-base: #4d8a6b` is canonical. Never the violet `#7c4cf0`.
- **No pure white canvas.** Use `--bg-shell` / `--bg-canvas`; pure `#fff` only for `--popover`.
- **Reference tokens, not hex.** Always `var(--token)` or Tailwind theme classes in components.
- **Glass tiers are intentional.** `.glass-strong` for fixed chrome (sidebars/toolbars), `.glass` for panels, `.glass-soft` for nested. Don't blur-stack the same surface twice.
- **Tiptap content gets `class="doc"`** so proposal + notes inherit document typography.
- **Compact density.** Match existing element sizes (20px pills, 32px fields/buttons, 12.5px doc body).
- **`.pm-eyebrow` for kickers, `.pm-h1` for page titles, `.mono-num` for any number.**

---

### File map
| Concern | File |
|---|---|
| Tokens, recipes, utilities | [`app/globals.css`](../app/globals.css) |
| Fonts (Geist + Geist Mono) | [`app/layout.tsx`](../app/layout.tsx) |
| Visual prototype | [`design/PropMaker.standalone.html`](./PropMaker.standalone.html) |
| UI primitives | [`components/ui/`](../components/ui/) |
| shadcn config | [`components.json`](../components.json) |
