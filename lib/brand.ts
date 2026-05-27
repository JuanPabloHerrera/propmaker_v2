// Brand color application
//
// Convention (matches the default palette in BrandPalette.tsx):
//   slot 0 → primary ink (body text)
//   slot 1 → paper background (rarely overridden — kept neutral)
//   slot 2 → primary accent (headers, links, accent fills)
//   slot 3 → secondary accent (callouts, dots)
//   slot 4+ → reserved for future use
//
// Derived shades use CSS color-mix() so the browser handles alpha
// without us needing a color-math library.

const ISO_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function isHex(value: string | undefined | null): value is string {
  return typeof value === 'string' && ISO_HEX.test(value)
}

interface BrandTokens {
  ink?: string
  accent?: string
  accent2?: string
}

/**
 * Pick safe values from the user's brand_colors[] array. Anything not
 * a valid hex is dropped so we never inject invalid CSS.
 */
export function pickBrandTokens(colors: readonly string[] | null | undefined): BrandTokens {
  if (!colors || colors.length === 0) return {}
  const safe = colors.filter(isHex)
  return {
    ink: safe[0],
    accent: safe[2],
    accent2: safe[3],
  }
}

/**
 * Returns the CSS body for a `<style>` block that overrides the
 * proposal-paper design tokens with the user's brand. Returns an
 * empty string when there's nothing to override so the caller can
 * skip rendering the tag.
 *
 * Scoped to `.proposal-paper` so the rest of the app keeps the
 * default sage palette.
 */
export function brandStyleBlock(colors: readonly string[] | null | undefined): string {
  const t = pickBrandTokens(colors)
  const decls: string[] = []
  if (t.ink) decls.push(`--ink-1: ${t.ink};`)
  if (t.accent) {
    decls.push(`--accent-base: ${t.accent};`)
    decls.push(`--ok: ${t.accent};`)
    // 10% alpha tint via color-mix; falls back gracefully in older engines
    decls.push(`--accent-soft: color-mix(in srgb, ${t.accent} 10%, transparent);`)
    decls.push(`--accent-tint: color-mix(in srgb, ${t.accent} 6%, transparent);`)
    decls.push(`--accent-glow: color-mix(in srgb, ${t.accent} 25%, transparent);`)
  }
  if (t.accent2) {
    decls.push(`--accent-2: ${t.accent2};`)
  } else if (t.accent) {
    // Derive a slightly lighter accent for gradients when no explicit
    // secondary is provided.
    decls.push(`--accent-2: color-mix(in srgb, ${t.accent} 70%, white);`)
  }
  if (decls.length === 0) return ''
  return `.proposal-paper{${decls.join('')}}`
}
