import JSZip from 'jszip'
import type { PptxTheme, PptxThemeBackground } from '@/types'

// ---------------------------------------------------------------------------
// Extract a visual theme (colors, fonts, background) from an uploaded .pptx.
//
// A .pptx is a zip of OOXML. We read:
//   - ppt/theme/theme1.xml   → <a:clrScheme> (accent/text/bg colors) + <a:fontScheme>
//   - ppt/slideMasters/slideMaster1.xml → <p:bg> (solid fill or background image)
// and derive contrast-safe text tokens so the exported deck stays legible on a
// light OR dark background. Returns null if the file can't be parsed as a deck;
// callers fall back to brand colors.
//
// All returned hex values omit the leading '#'.
// ---------------------------------------------------------------------------

const DEFAULT_ACCENT = '4D8A6B'
const DEFAULT_INK = '2B2620'
const DEFAULT_FONT = 'Arial'

/** Scheme names used in slide XML → theme clrScheme element (default color map). */
const SCHEME_ALIAS: Record<string, string> = {
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
}

export async function extractPptxTheme(
  buf: ArrayBuffer | Buffer | Uint8Array,
): Promise<PptxTheme | null> {
  try {
    const zip = await JSZip.loadAsync(buf)

    const themeXml = await readFirst(zip, [
      'ppt/theme/theme1.xml',
      ...listMatching(zip, /^ppt\/theme\/theme\d+\.xml$/),
    ])
    if (!themeXml) return null

    const clrScheme = section(themeXml, 'a:clrScheme')
    const colors = clrScheme ? parseColorScheme(clrScheme) : {}
    const resolve = (name: string): string | undefined => {
      const key = SCHEME_ALIAS[name] ?? name
      return colors[key]
    }

    const accent = colors.accent1 ?? DEFAULT_ACCENT
    const accent2 = colors.accent2 ?? accent

    // Fonts
    const majorFont = fontFace(themeXml, 'a:majorFont') ?? DEFAULT_FONT
    const minorFont = fontFace(themeXml, 'a:minorFont') ?? majorFont

    // Background from the slide master (falls back to theme lt1 / white).
    const background = await parseBackground(zip, resolve, colors.lt1)

    // Contrast-aware text tokens derived from the background.
    const bgHex = background?.type === 'color' ? background.color : undefined
    // For an image background whose luminance we can't cheaply know, assume a
    // light-ish background and use the theme's dark text (dk1).
    const isDark = bgHex ? luminance(bgHex) < 0.5 : false

    const ink = isDark ? 'F4F2EE' : colors.dk1 ?? DEFAULT_INK
    const muted = isDark ? 'C9C4BD' : '6B6259'
    const faint = isDark ? '9A948C' : '9A938B'
    const hairline = isDark ? '5A554F' : 'E4E0DA'
    const base = bgHex ?? (isDark ? '1E1B18' : 'FFFFFF')
    const zebra: [string, string] = [mix(base, isDark ? 'FFFFFF' : '000000', 0.05), base]

    return {
      accent: ensureContrast(accent, bgHex, ink),
      accent2,
      ink,
      muted,
      faint,
      hairline,
      majorFont,
      minorFont,
      background,
      zebra,
    }
  } catch {
    return null
  }
}

/** Strip heavy image bytes so the theme can be stored compactly on the row. */
export function themeForStorage(theme: PptxTheme): PptxTheme {
  if (theme.background?.type === 'image') {
    return { ...theme, background: { type: 'image' } }
  }
  return theme
}

// --------------------------------------------------------------------------
// XML helpers (targeted regex over well-defined OOXML — no XML lib needed)
// --------------------------------------------------------------------------

function listMatching(zip: JSZip, re: RegExp): string[] {
  return Object.keys(zip.files).filter((n) => re.test(n))
}

async function readFirst(zip: JSZip, paths: string[]): Promise<string | null> {
  for (const p of paths) {
    const f = zip.file(p)
    if (f) return f.async('string')
  }
  return null
}

/** Return the inner XML of the first <tag ...>…</tag>. */
function section(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  return re.exec(xml)?.[1] ?? null
}

/** Read a color (srgbClr val OR sysClr lastClr) from within an XML fragment. */
function colorFrom(fragment: string): string | undefined {
  const srgb = /<a:srgbClr\s+val="([0-9a-fA-F]{6})"/.exec(fragment)
  if (srgb) return srgb[1].toUpperCase()
  const sys = /<a:sysClr\b[^>]*lastClr="([0-9a-fA-F]{6})"/.exec(fragment)
  if (sys) return sys[1].toUpperCase()
  return undefined
}

/** Parse the theme <a:clrScheme> into { dk1, lt1, dk2, lt2, accent1.. } hexes. */
function parseColorScheme(clrScheme: string): Record<string, string> {
  const out: Record<string, string> = {}
  const names = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
  for (const name of names) {
    const frag = section(clrScheme, `a:${name}`)
    if (frag) {
      const c = colorFrom(frag)
      if (c) out[name] = c
    }
  }
  return out
}

/** Read the latin typeface from <a:majorFont>/<a:minorFont>. */
function fontFace(themeXml: string, tag: string): string | undefined {
  const frag = section(themeXml, tag)
  if (!frag) return undefined
  const m = /<a:latin\s+typeface="([^"]*)"/.exec(frag)
  const face = m?.[1]?.trim()
  if (!face || face.startsWith('+')) return undefined
  return face
}

async function parseBackground(
  zip: JSZip,
  resolve: (name: string) => string | undefined,
  lt1: string | undefined,
): Promise<PptxThemeBackground> {
  const masterPath =
    listMatching(zip, /^ppt\/slideMasters\/slideMaster\d+\.xml$/).sort()[0]
  const masterXml = masterPath ? await zip.file(masterPath)?.async('string') : null

  const bg = masterXml ? section(masterXml, 'p:bg') : null
  if (bg) {
    // Background image (blipFill → media)
    const embed = /<a:blip\s+[^>]*r:embed="([^"]+)"/.exec(bg)?.[1]
    if (embed && masterPath) {
      const dataUri = await resolveEmbeddedImage(zip, masterPath, embed)
      if (dataUri) return { type: 'image', dataUri }
    }
    // Solid fill: explicit srgb/sysClr, or a scheme color reference
    const solid = section(bg, 'a:solidFill')
    if (solid) {
      const direct = colorFrom(solid)
      if (direct) return { type: 'color', color: direct }
      const scheme = /<a:schemeClr\s+val="([^"]+)"/.exec(solid)?.[1]
      const resolved = scheme ? resolve(scheme) : undefined
      if (resolved) return { type: 'color', color: resolved }
    }
    // bgRef idx + scheme color
    const bgRef = section(bg, 'p:bgRef')
    if (bgRef) {
      const scheme = /<a:schemeClr\s+val="([^"]+)"/.exec(bgRef)?.[1]
      const resolved = scheme ? resolve(scheme) : undefined
      if (resolved) return { type: 'color', color: resolved }
    }
  }

  // No usable master background → the light/background theme color, else white.
  return { type: 'color', color: lt1 ?? 'FFFFFF' }
}

async function resolveEmbeddedImage(
  zip: JSZip,
  ownerPath: string,
  relId: string,
): Promise<string | undefined> {
  // ppt/slideMasters/slideMaster1.xml → ppt/slideMasters/_rels/slideMaster1.xml.rels
  const dir = ownerPath.slice(0, ownerPath.lastIndexOf('/'))
  const file = ownerPath.slice(ownerPath.lastIndexOf('/') + 1)
  const relsPath = `${dir}/_rels/${file}.rels`
  const relsXml = await zip.file(relsPath)?.async('string')
  if (!relsXml) return undefined
  const re = new RegExp(`<Relationship\\b[^>]*Id="${relId}"[^>]*Target="([^"]+)"`, 'i')
  const target = re.exec(relsXml)?.[1]
  if (!target) return undefined

  // Resolve target (often "../media/image1.png") relative to the owner dir.
  const resolved = normalizePath(`${dir}/${target}`)
  const mediaFile = zip.file(resolved)
  if (!mediaFile) return undefined
  const ext = resolved.slice(resolved.lastIndexOf('.') + 1).toLowerCase()
  const mime = ext === 'png' ? 'image/png' : /jpe?g/.test(ext) ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : null
  if (!mime) return undefined // raster only — pptxgenjs can't embed emf/svg backgrounds
  const b64 = await mediaFile.async('base64')
  return `data:${mime};base64,${b64}`
}

function normalizePath(path: string): string {
  const parts: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

// --------------------------------------------------------------------------
// Color math
// --------------------------------------------------------------------------

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return (c(r) + c(g) + c(b)).toUpperCase()
}

/** Relative luminance 0..1 (perceptual). */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex)
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Blend `hex` toward `toward` by `ratio` (0..1). */
function mix(hex: string, toward: string, ratio: number): string {
  const a = toRgb(hex)
  const b = toRgb(toward)
  return toHex([
    a[0] + (b[0] - a[0]) * ratio,
    a[1] + (b[1] - a[1]) * ratio,
    a[2] + (b[2] - a[2]) * ratio,
  ])
}

/** WCAG contrast ratio between two hexes. */
function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** If `accent` reads poorly on the background, fall back to the ink color. */
function ensureContrast(accent: string, bg: string | undefined, ink: string): string {
  if (!bg) return accent
  return contrast(accent, bg) >= 2.2 ? accent : ink
}
