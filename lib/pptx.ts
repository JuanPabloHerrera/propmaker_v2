import PptxGenJS from 'pptxgenjs'
import { pickBrandTokens } from '@/lib/brand'
import { tiptapToSections, inlineText, type ProposalSection } from '@/lib/tiptap'
import { PPTX_ICONS, PPTX_BG_NAVY } from '@/lib/pptx-icons'
import type { Meeting, PptxTheme, TiptapDocument, TiptapNode, UserProfile } from '@/types'

// ---------------------------------------------------------------------------
// PowerPoint (PPTX) generation for proposals — BRANDED design.
//
// Produces a designed deck in a dark/light "sandwich": a dark branded cover and
// closing, light content slides, an icon-in-circle motif, and a branded line-
// items table. The palette adapts to the user's brand (`profile.brand_colors`)
// or an uploaded template's extracted theme; the logo is embedded from
// `profile.logo_url`. Icons are a bundled static white set (`lib/pptx-icons.ts`)
// so nothing needs generating at runtime on serverless.
// ---------------------------------------------------------------------------

const SERIF = 'Georgia' // elegant serif present on Windows + macOS (titles + body)
const SANS = 'Arial' // universal sans for eyebrows/labels
const SAGE = '4D8A6B'
const INK = '1A2333'

// LAYOUT_WIDE = 13.33in x 7.5in (16:9)
const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.7
const CONTENT_W = SLIDE_W - MARGIN * 2 // 11.933
const BODY_TOP = 1.75
const BODY_H = 5.1
const MAX_LINES = 18
const MAX_SLIDES = 60

// ---- color helpers (no external color lib) --------------------------------
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
function rgb(h: string): [number, number, number] {
  let s = h.replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0]
}
const toHex = (c: [number, number, number]) => c.map((v) => clamp(v).toString(16).padStart(2, '0')).join('').toUpperCase()
function mix(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b)
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}
const darken = (h: string, t: number) => mix(h, '000000', t)
const lighten = (h: string, t: number) => mix(h, 'FFFFFF', t)
function lum(h: string): number {
  const [r, g, b] = rgb(h).map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** strip the leading '#' pptxgenjs doesn't want, with a fallback. */
const hex = (c: string | undefined, fallback: string): string =>
  c && /^#?[0-9a-f]{3,6}$/i.test(c) ? c.replace('#', '').toUpperCase() : fallback

/** Pick black or white text that reads on the given fill color. */
function readableOn(fill: string): string {
  return lum(fill) > 0.58 ? '111111' : 'FFFFFF'
}

interface Theme {
  primary: string // deep navy (solid fallback; dark slides use the gradient image)
  accent: string // vivid brand accent
  accentLt: string // light accent (eyebrows/outlines/numbers on dark)
  ink: string // body text on light
  gray: string // captions/footers
  muted: string
  faint: string
  hairline: string
  light: string // content-slide background
  card: string
  onDark: string // body text on the dark background
  majorFont: string // titles (serif)
  minorFont: string // body (serif)
  eyebrowFont: string // eyebrows/labels (sans caps)
  zebra: [string, string]
}

export interface BuildProposalPptxInput {
  proposal: { content_json: TiptapDocument | null }
  meeting: Meeting | null
  profile: UserProfile | null
  preparedOn?: string
  /** When set, styles the deck from an uploaded .pptx template's extracted theme. */
  template?: PptxTheme | null
}

/**
 * Build the branded theme. The dark cover/closing use a fixed premium navy
 * gradient (PPTX_BG_NAVY) for a consistent, template-like look; the brand only
 * drives the ACCENT (eyebrow, icon circles, rule, table header) — so a gray-ink
 * brand no longer produces a gray deck. A `.pptx` template's fonts still win.
 */
function resolveTheme(template: PptxTheme | null | undefined, profile: UserProfile | null): Theme {
  const accent = template
    ? hex(template.accent, SAGE)
    : hex(pickBrandTokens(profile?.brand_colors).accent, SAGE)
  return {
    primary: '0C2247', // deep navy (solid fallback; dark slides use the gradient image)
    accent,
    accentLt: mix(accent, 'FFFFFF', 0.5),
    ink: INK,
    gray: '5B6472',
    muted: '6B6259',
    faint: '9A938B',
    hairline: 'E4E0DA',
    light: 'F5F7FB',
    card: 'FFFFFF',
    onDark: 'C9D6EC',
    majorFont: template?.majorFont || SERIF,
    minorFont: template?.minorFont || template?.majorFont || SERIF,
    eyebrowFont: template?.majorFont || SANS,
    zebra: ['FBFAF7', 'FFFFFF'],
  }
}

// ---- the icon-in-circle motif ---------------------------------------------
function iconCircle(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  d: number,
  color: string,
  icon: string,
  outline = false,
) {
  slide.addShape('ellipse', {
    x, y, w: d, h: d,
    fill: outline ? { type: 'none' } : { color },
    line: outline ? { color, width: 1.25 } : { type: 'none' },
  })
  const data = PPTX_ICONS[icon]
  if (data) {
    const id = d * 0.5
    slide.addImage({ data, x: x + (d - id) / 2, y: y + (d - id) / 2, w: id, h: id })
  }
}

/**
 * Build a branded, editable .pptx from a proposal. Returns a Node Buffer.
 */
export async function buildProposalPptx({
  proposal,
  meeting,
  profile,
  preparedOn,
  template,
}: BuildProposalPptxInput): Promise<Buffer> {
  const theme = resolveTheme(template, profile)
  const logo = await fetchLogoDataUri(profile?.logo_url ?? null)
  const company = profile?.company_name ?? profile?.full_name ?? 'PropMaker'
  const kicker = (meeting?.client_company?.trim() || company || 'Proposal').toUpperCase()

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = company
  pptx.company = company
  pptx.subject = 'Proposal'

  // Light content master: footer + slide number + accent hairline.
  pptx.defineSlideMaster({
    title: 'PM_CONTENT',
    background: { color: theme.light },
    objects: [
      { rect: { x: 0, y: 7.19, w: '100%', h: 0.02, fill: { color: theme.accent } } },
      {
        text: {
          text: company,
          options: { x: MARGIN, y: 7.02, w: 9, h: 0.32, fontFace: theme.minorFont, fontSize: 8, color: theme.gray, valign: 'middle' },
        },
      },
    ],
    slideNumber: { x: 12.1, y: 7.02, w: 0.9, h: 0.32, fontFace: theme.minorFont, fontSize: 8, color: theme.gray, align: 'right' },
  })

  const sections = tiptapToSections(proposal.content_json)
  addCoverSlide(pptx, { meeting, profile, theme, logo, preparedOn, sections })

  const brand = { logo, kicker }
  let slideCount = 1
  for (const section of sections) {
    const remaining = MAX_SLIDES - slideCount
    if (remaining <= 0) break
    const table = section.nodes.find((n) => n.type === 'table')
    slideCount += table
      ? addTableSlide(pptx, section, table, theme, remaining, brand)
      : addContentSlides(pptx, section, theme, remaining, brand)
  }

  addClosingSlide(pptx, { meeting, profile, theme, logo })

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as unknown
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)
}

interface Brand {
  logo?: string
  kicker: string
}

// --------------------------------------------------------------------------
// Cover (dark) + Closing (dark)
// --------------------------------------------------------------------------

const PILLAR_ICONS = ['target', 'chartBar', 'shield', 'route', 'cog', 'handshake']

function coverPillars(sections: ProposalSection[]): { icon: string; label: string }[] {
  const skip = /executive summary|budget|pricing|line items/i
  const picks = sections.map((s) => s.title).filter((t) => t && !skip.test(t)).slice(0, 3)
  const labels = picks.length ? picks : ['Approach', 'Deliverables', 'Timeline']
  return labels.map((label, i) => ({ icon: PILLAR_ICONS[i % PILLAR_ICONS.length], label }))
}

function coverSecondary(meeting: Meeting | null, profile: UserProfile | null): string {
  const title = meeting?.title?.trim()
  const company = meeting?.client_company?.trim()
  if (title && company && title.toLowerCase() !== company.toLowerCase()) return title
  if (profile?.tagline?.trim()) return profile.tagline.trim()
  return ''
}

function addCoverSlide(
  pptx: PptxGenJS,
  opts: {
    meeting: Meeting | null
    profile: UserProfile | null
    theme: Theme
    logo?: string
    preparedOn?: string
    sections: ProposalSection[]
  },
) {
  const { meeting, profile, theme, logo, preparedOn, sections } = opts
  const slide = pptx.addSlide()
  slide.background = { data: PPTX_BG_NAVY }

  if (logo) {
    slide.addImage({ data: logo, x: MARGIN, y: 0.75, w: 2.0, h: 1.0, sizing: { type: 'contain', w: 2.0, h: 1.0 } })
  }

  slide.addText('PROPOSAL', {
    x: MARGIN, y: 2.7, w: CONTENT_W, h: 0.4,
    fontFace: theme.eyebrowFont, fontSize: 13, bold: true, color: theme.accentLt, charSpacing: 3,
  })

  const title = meeting?.client_company?.trim() || meeting?.title?.trim() || 'Proposal'
  slide.addText(title, {
    x: MARGIN - 0.02, y: 3.12, w: CONTENT_W - 0.8, h: 1.25,
    fontFace: theme.majorFont, fontSize: 44, bold: true, color: 'FFFFFF', valign: 'top', fit: 'shrink',
  })

  const sub = coverSecondary(meeting, profile)
  if (sub) {
    slide.addText(sub, {
      x: MARGIN, y: 4.4, w: CONTENT_W - 0.8, h: 0.85,
      fontFace: theme.minorFont, fontSize: 16, color: theme.onDark, lineSpacingMultiple: 1.15, valign: 'top',
    })
  }

  const pillars = coverPillars(sections)
  const step = Math.min(3.9, CONTENT_W / pillars.length)
  let px = MARGIN
  pillars.forEach((p) => {
    iconCircle(slide, px, 5.7, 0.62, theme.accentLt, p.icon, true)
    slide.addText(p.label, {
      x: px + 0.78, y: 5.66, w: Math.min(2.9, step - 0.95), h: 0.7,
      fontFace: theme.minorFont, fontSize: 11.5, bold: true, color: 'E6EEF9', valign: 'middle', lineSpacingMultiple: 0.95,
    })
    px += step
  })

  const company = profile?.company_name ?? profile?.full_name ?? 'PropMaker'
  slide.addText(`${company}${preparedOn ? '  ·  ' + preparedOn : ''}  ·  Confidential`, {
    x: MARGIN, y: 6.95, w: CONTENT_W, h: 0.3,
    fontFace: theme.minorFont, fontSize: 10.5, color: lighten(theme.primary, 0.52),
  })
}

function addClosingSlide(
  pptx: PptxGenJS,
  opts: { meeting: Meeting | null; profile: UserProfile | null; theme: Theme; logo?: string },
) {
  const { meeting, profile, theme, logo } = opts
  const slide = pptx.addSlide()
  slide.background = { data: PPTX_BG_NAVY }
  if (logo) {
    slide.addImage({ data: logo, x: (SLIDE_W - 2.4) / 2, y: 2.15, w: 2.4, h: 1.2, sizing: { type: 'contain', w: 2.4, h: 1.2 } })
  }
  const client = meeting?.client_company?.trim()
  slide.addText(client ? `Thank you, ${client}.` : 'Thank you.', {
    x: 1.5, y: 3.75, w: SLIDE_W - 3, h: 0.7,
    fontFace: theme.majorFont, fontSize: 26, bold: true, color: 'FFFFFF', align: 'center',
  })
  const company = profile?.company_name ?? profile?.full_name ?? 'PropMaker'
  slide.addText(`${company}  ·  Confidential`, {
    x: 1.5, y: 6.6, w: SLIDE_W - 3, h: 0.35,
    fontFace: theme.minorFont, fontSize: 11, color: lighten(theme.primary, 0.52), align: 'center',
  })
}

// --------------------------------------------------------------------------
// Content slides (light) — branded header + flowing body
// --------------------------------------------------------------------------

/** Branded header: accent eyebrow + title + accent rule + small logo. */
function contentHeader(slide: PptxGenJS.Slide, title: string, theme: Theme, brand: Brand, cont: boolean) {
  slide.addText(brand.kicker, {
    x: MARGIN, y: 0.5, w: 9, h: 0.3,
    fontFace: theme.eyebrowFont, fontSize: 11.5, bold: true, color: theme.accent, charSpacing: 2,
  })
  slide.addText(cont ? `${title} (cont.)` : title, {
    x: MARGIN, y: 0.82, w: CONTENT_W - 1.7, h: 0.72,
    fontFace: theme.majorFont, fontSize: 25, bold: true, color: theme.ink, valign: 'top', fit: 'shrink',
  })
  if (brand.logo) {
    slide.addImage({ data: brand.logo, x: SLIDE_W - MARGIN - 1.35, y: 0.5, w: 1.35, h: 0.52, sizing: { type: 'contain', w: 1.35, h: 0.52 } })
  }
  slide.addShape('rect', { x: MARGIN, y: 1.52, w: 0.8, h: 0.035, fill: { color: theme.accent }, line: { type: 'none' } })
}

/** Returns the number of slides added. */
function addContentSlides(
  pptx: PptxGenJS,
  section: ProposalSection,
  theme: Theme,
  remaining: number,
  brand: Brand,
): number {
  if (remaining <= 0) return 0
  const paras = sectionParagraphs(section.nodes, theme)
  if (paras.length === 0 && !section.title) return 0

  const chunks: Para[][] = []
  let cur: Para[] = []
  let used = 0
  for (const p of paras) {
    if (cur.length && used + p.lines > MAX_LINES) {
      chunks.push(cur)
      cur = []
      used = 0
    }
    cur.push(p)
    used += p.lines
  }
  if (cur.length || chunks.length === 0) chunks.push(cur)

  const capped = chunks.slice(0, remaining)
  capped.forEach((chunk, i) => {
    const slide = pptx.addSlide({ masterName: 'PM_CONTENT' })
    contentHeader(slide, section.title || 'Overview', theme, brand, i > 0)
    const runs = chunk.flatMap((p) => p.runs)
    if (runs.length) {
      slide.addText(runs, {
        x: MARGIN, y: BODY_TOP, w: CONTENT_W, h: BODY_H,
        fontFace: theme.minorFont, color: theme.ink, valign: 'top', fit: 'shrink',
      })
    }
  })
  return capped.length
}

/**
 * Convert a section's block nodes into estimated paragraphs. Tables are skipped
 * here (handled by `addTableSlide`).
 */
function sectionParagraphs(nodes: TiptapNode[], theme: Theme): Para[] {
  const out: Para[] = []
  walkBlocks(nodes, out, theme, null, false)
  return out
}

interface Para {
  runs: PptxGenJS.TextProps[]
  lines: number
}

interface ListCtx {
  depth: number
  ordered: boolean
}

function walkBlocks(
  nodes: TiptapNode[] | undefined,
  out: Para[],
  theme: Theme,
  list: ListCtx | null,
  quote: boolean,
) {
  for (const node of nodes ?? []) {
    switch (node.type) {
      case 'heading': {
        const text = inlineText(node.content)
        if (!text) break
        pushPara(out, inlineRuns(node.content), {
          bold: true,
          color: theme.ink,
          fontSize: 14,
          paraSpaceBefore: 6,
          paraSpaceAfter: 3,
        })
        break
      }
      case 'paragraph': {
        if (!inlineText(node.content)) break
        const para: PptxGenJS.TextPropsOptions = {
          color: quote ? theme.muted : theme.ink,
          italic: quote || undefined,
          fontSize: 13,
          paraSpaceAfter: list ? 3 : 7,
        }
        if (list) {
          para.bullet = list.ordered ? { type: 'number' } : true
          para.indentLevel = list.depth
        } else if (quote) {
          para.indentLevel = 1
        }
        pushPara(out, inlineRuns(node.content), para)
        break
      }
      case 'bulletList':
        walkBlocks(node.content, out, theme, { depth: (list?.depth ?? -1) + 1, ordered: false }, quote)
        break
      case 'orderedList':
        walkBlocks(node.content, out, theme, { depth: (list?.depth ?? -1) + 1, ordered: true }, quote)
        break
      case 'listItem':
        walkBlocks(node.content, out, theme, list, quote)
        break
      case 'blockquote':
        walkBlocks(node.content, out, theme, list, true)
        break
      case 'codeBlock': {
        const text = inlineText(node.content)
        if (!text) break
        pushPara(out, [{ text, options: { fontFace: 'Courier New' } }], {
          color: theme.muted,
          fontSize: 11,
          fill: { color: theme.zebra[0] },
          paraSpaceAfter: 6,
        })
        break
      }
      // horizontalRule / table / others: skipped in text flow
      default:
        break
    }
  }
}

/** Inline nodes → runs carrying only mark-derived options (bold/italic/code/link). */
function inlineRuns(nodes: TiptapNode[] | undefined): PptxGenJS.TextProps[] {
  const runs: PptxGenJS.TextProps[] = []
  for (const node of nodes ?? []) {
    if (node.type === 'text' && node.text) {
      const options: PptxGenJS.TextPropsOptions = {}
      for (const m of node.marks ?? []) {
        if (m.type === 'bold') options.bold = true
        else if (m.type === 'italic') options.italic = true
        else if (m.type === 'code') options.fontFace = 'Courier New'
        else if (m.type === 'link' && typeof m.attrs?.href === 'string') {
          options.hyperlink = { url: m.attrs.href as string }
        }
      }
      runs.push({ text: node.text, options })
    } else if (node.type === 'hardBreak') {
      runs.push({ text: '', options: { breakLine: true } })
    } else if (node.content) {
      runs.push(...inlineRuns(node.content))
    }
  }
  if (runs.length === 0) runs.push({ text: '' })
  return runs
}

/**
 * Append one paragraph's runs to the flat run list, applying paragraph-level
 * options to every run (pptxgenjs reads paragraph props off its runs) and
 * marking a line break at the paragraph boundary. Also estimates line count for
 * the overflow chunker.
 */
function pushPara(
  out: Para[],
  runs: PptxGenJS.TextProps[],
  paraOpts: PptxGenJS.TextPropsOptions,
) {
  const merged = runs.map((r) => ({
    text: r.text,
    options: { ...paraOpts, ...r.options },
  }))
  merged[merged.length - 1].options = {
    ...merged[merged.length - 1].options,
    breakLine: true,
  }

  const chars = runs.reduce((n, r) => n + (r.text?.length ?? 0), 0)
  const indent = typeof paraOpts.indentLevel === 'number' ? paraOpts.indentLevel : 0
  const fontSize = typeof paraOpts.fontSize === 'number' ? paraOpts.fontSize : 13
  const cpl = Math.max(30, Math.round((CONTENT_W * 96) / (fontSize * 0.52)) - indent * 12)
  const lines = Math.max(1, Math.ceil(chars / cpl)) + 0.5

  out.push({ runs: merged, lines })
}

// --------------------------------------------------------------------------
// Table slide (Recommended Line Items)
// --------------------------------------------------------------------------

/** Returns the number of primary slides added (autopaged overflow not counted). */
function addTableSlide(
  pptx: PptxGenJS,
  section: ProposalSection,
  tableNode: TiptapNode,
  theme: Theme,
  remaining: number,
  brand: Brand,
): number {
  if (remaining <= 0) return 0
  const rows = (tableNode.content ?? []).filter((n) => n.type === 'tableRow')
  if (rows.length === 0) {
    return addContentSlides(pptx, section, theme, remaining, brand)
  }

  const slide = pptx.addSlide({ masterName: 'PM_CONTENT' })
  contentHeader(slide, section.title || 'Line Items', theme, brand, false)

  let tableY = BODY_TOP
  const preTable: TiptapNode[] = []
  for (const n of section.nodes) {
    if (n === tableNode) break
    preTable.push(n)
  }
  const introParas = sectionParagraphs(preTable, theme)
  const introLines = introParas.reduce((n, p) => n + p.lines, 0)
  if (introParas.length > 0 && introLines <= 5) {
    const runs = introParas.flatMap((p) => p.runs)
    const introH = Math.min(1.4, 0.32 + introLines * 0.24)
    slide.addText(runs, {
      x: MARGIN, y: BODY_TOP, w: CONTENT_W, h: introH,
      fontFace: theme.minorFont, color: theme.ink, valign: 'top', fit: 'shrink',
    })
    tableY = BODY_TOP + introH + 0.15
  }

  const headers = (rows[0].content ?? []).map(cellText)
  const colW = columnWidths(headers)
  const rightCol = headers.map((h) => /price|amount|total|cost|qty|quantity|rate|value|subtotal/i.test(h))

  const headerText = readableOn(theme.accent)
  const tableRows: PptxGenJS.TableRow[] = rows.map((row, ri) => {
    const cells = row.content ?? []
    return cells.map((cell, ci) => {
      const text = cellText(cell)
      const options: PptxGenJS.TableCellProps =
        ri === 0
          ? {
              fill: { color: theme.accent },
              color: headerText,
              bold: true,
              valign: 'middle',
              align: rightCol[ci] ? 'right' : 'left',
              margin: [4, 6, 4, 6],
            }
          : {
              color: theme.ink,
              valign: 'middle',
              align: rightCol[ci] ? 'right' : 'left',
              fill: { color: ri % 2 === 0 ? theme.zebra[0] : theme.zebra[1] },
              margin: [4, 6, 4, 6],
            }
      return { text, options }
    })
  })

  slide.addTable(tableRows, {
    x: MARGIN, y: tableY, w: CONTENT_W, colW,
    fontFace: theme.minorFont, fontSize: 11, color: theme.ink, valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: theme.hairline },
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageSlideStartY: 0.9,
  })
  return 1
}

/** Weighted column widths (inches) summing to CONTENT_W. */
function columnWidths(headers: string[]): number[] {
  if (headers.length === 0) return [CONTENT_W]
  const weights = headers.map((h) => {
    if (/description|scope|detail|notes|summary/i.test(h)) return 2.8
    if (/item|service|deliverable|name|product/i.test(h)) return 1.5
    return 1
  })
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => Number(((CONTENT_W * w) / total).toFixed(2)))
}

/** Extract plain text from a table cell (its paragraphs joined). */
function cellText(cell: TiptapNode): string {
  return (cell.content ?? [])
    .map((block) => inlineText(block.content))
    .filter(Boolean)
    .join(' ')
    .trim()
}

// --------------------------------------------------------------------------
// Logo embedding
// --------------------------------------------------------------------------

const MAX_LOGO_BYTES = 5 * 1024 * 1024

/** Sniff a raster image's MIME from its magic bytes. We do NOT trust the HTTP
 * `content-type` — Supabase public URLs can serve a generic type, which would
 * make a strict header check drop a perfectly valid PNG/JPG logo. */
function sniffImageMime(u8: Uint8Array): string | undefined {
  if (u8.length >= 4 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'image/png'
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg'
  if (u8.length >= 3 && u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'image/gif'
  return undefined
}

/**
 * Fetch a public logo URL and return a data URI for pptxgenjs. The image type is
 * determined by sniffing the bytes (not the response header). Returns undefined
 * on any failure, non-raster bytes, or oversized image so the deck degrades to
 * text-only gracefully. pptxgenjs embeds raster formats (PNG/JPG/GIF) only.
 */
async function fetchLogoDataUri(url: string | null): Promise<string | undefined> {
  if (!url) return undefined
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) return undefined
    const mime = sniffImageMime(new Uint8Array(bytes))
    if (!mime) return undefined
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return undefined
  }
}
