import PptxGenJS from 'pptxgenjs'
import { pickBrandTokens } from '@/lib/brand'
import { tiptapToSections, inlineText, type ProposalSection } from '@/lib/tiptap'
import type { Meeting, PptxTheme, TiptapDocument, TiptapNode, UserProfile } from '@/types'

// ---------------------------------------------------------------------------
// PowerPoint (PPTX) generation for proposals.
//
// A proposal is a single Tiptap document (see `proposals.content_json`) that the
// AI generates with a fixed `##` (h2) section skeleton. We split on those
// headings (`tiptapToSections`) and emit a native, editable deck:
//   - a branded cover slide
//   - one content slide per section (long sections spill onto "(cont.)" slides)
//   - the "Recommended Line Items" section rendered as a native table
//
// Theme colors come from the user's `brand_colors` via `pickBrandTokens`; the
// logo (a public Supabase Storage URL) is fetched and embedded as a data URI.
// ---------------------------------------------------------------------------

const FONT = 'Arial' // default face — Geist isn't present on viewers' machines
const SAGE = '4d8a6b'
const INK = '2b2620'
const MUTED = '6B6259'
const FAINT = '9A938B'
const HAIRLINE = 'E4E0DA'

// LAYOUT_WIDE = 13.33in x 7.5in (16:9)
const SLIDE_W = 13.33
const MARGIN = 0.75
const CONTENT_W = SLIDE_W - MARGIN * 2 // 11.83
const BODY_TOP = 1.55
const BODY_H = 5.35 // usable body height before the footer
const MAX_LINES = 21 // paragraph-line budget per content slide
const MAX_SLIDES = 60 // guardrail against pathological input

/** strip the leading '#' pptxgenjs doesn't want, with a fallback. */
const hex = (c: string | undefined, fallback: string): string =>
  c && /^#?[0-9a-f]{3,6}$/i.test(c) ? c.replace('#', '') : fallback

/** Pick black or white text that reads on the given fill color. */
function readableOn(fill: string): string {
  const h = fill.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  // Perceived brightness (YIQ); light fills → dark text.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '111111' : 'FFFFFF'
}

interface Background {
  type: 'color' | 'image'
  color?: string
  dataUri?: string
}

interface Theme {
  accent: string
  accent2: string
  ink: string
  muted: string
  faint: string
  hairline: string
  majorFont: string
  minorFont: string
  zebra: [string, string]
  background: Background
}

export interface BuildProposalPptxInput {
  proposal: { content_json: TiptapDocument | null }
  meeting: Meeting | null
  profile: UserProfile | null
  /** Human-readable "prepared on" date, formatted by the caller. */
  preparedOn?: string
  /** When set, styles the deck from an uploaded .pptx template instead of brand colors. */
  template?: PptxTheme | null
}

/** Build the render theme from a template (preferred) or the user's brand colors. */
function resolveTheme(template: PptxTheme | null | undefined, profile: UserProfile | null): Theme {
  if (template) {
    return {
      accent: hex(template.accent, SAGE),
      accent2: hex(template.accent2, hex(template.accent, SAGE)),
      ink: hex(template.ink, INK),
      muted: hex(template.muted, MUTED),
      faint: hex(template.faint, FAINT),
      hairline: hex(template.hairline, HAIRLINE),
      majorFont: template.majorFont || FONT,
      minorFont: template.minorFont || template.majorFont || FONT,
      zebra: [hex(template.zebra?.[0], 'FBFAF7'), hex(template.zebra?.[1], 'FFFFFF')],
      background:
        template.background?.type === 'image' && template.background.dataUri
          ? { type: 'image', dataUri: template.background.dataUri }
          : { type: 'color', color: hex(template.background?.color, 'FFFFFF') },
    }
  }
  const t = pickBrandTokens(profile?.brand_colors)
  const accent = hex(t.accent, SAGE)
  return {
    accent,
    accent2: hex(t.accent2, accent),
    ink: hex(t.ink, INK),
    muted: MUTED,
    faint: FAINT,
    hairline: HAIRLINE,
    majorFont: FONT,
    minorFont: FONT,
    zebra: ['FBFAF7', 'FFFFFF'],
    background: { type: 'color', color: 'FFFFFF' },
  }
}

/** Convert a theme background into a pptxgenjs BackgroundProps. */
function bgProps(bg: Background): PptxGenJS.BackgroundProps {
  return bg.type === 'image' && bg.dataUri ? { data: bg.dataUri } : { color: bg.color ?? 'FFFFFF' }
}

/**
 * Build a branded, editable .pptx from a proposal. Returns a Node Buffer ready
 * to stream from an API route.
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

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = profile?.company_name ?? profile?.full_name ?? 'PropMaker'
  pptx.company = profile?.company_name ?? 'PropMaker'
  pptx.subject = 'Proposal'

  const footer = profile?.company_name ?? profile?.full_name ?? 'PropMaker'
  pptx.defineSlideMaster({
    title: 'PM_CONTENT',
    background: bgProps(theme.background),
    objects: [
      { rect: { x: 0, y: 7.19, w: '100%', h: 0.02, fill: { color: theme.accent } } },
      {
        text: {
          text: footer,
          options: {
            x: MARGIN,
            y: 7.02,
            w: 9,
            h: 0.32,
            fontFace: theme.minorFont,
            fontSize: 8,
            color: theme.faint,
            valign: 'middle',
          },
        },
      },
    ],
    slideNumber: {
      x: 12.1,
      y: 7.02,
      w: 0.9,
      h: 0.32,
      fontFace: theme.minorFont,
      fontSize: 8,
      color: theme.faint,
      align: 'right',
    },
  })

  addCoverSlide(pptx, { meeting, profile, theme, logo, preparedOn })

  const sections = tiptapToSections(proposal.content_json)
  let slideCount = 1 // the cover
  for (const section of sections) {
    const remaining = MAX_SLIDES - slideCount
    if (remaining <= 0) break
    const table = section.nodes.find((n) => n.type === 'table')
    slideCount += table
      ? addTableSlide(pptx, section, table, theme, remaining)
      : addContentSlides(pptx, section, theme, remaining)
  }

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as unknown
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)
}

// --------------------------------------------------------------------------
// Cover
// --------------------------------------------------------------------------

function addCoverSlide(
  pptx: PptxGenJS,
  opts: {
    meeting: Meeting | null
    profile: UserProfile | null
    theme: Theme
    logo?: string
    preparedOn?: string
  },
) {
  const { meeting, profile, theme, logo, preparedOn } = opts
  const slide = pptx.addSlide()
  slide.background = bgProps(theme.background)

  // Accent bars top + bottom.
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.28,
    fill: { color: theme.accent },
    line: { type: 'none' },
  })
  slide.addShape('rect', {
    x: 0,
    y: 7.22,
    w: '100%',
    h: 0.28,
    fill: { color: theme.accent2 },
    line: { type: 'none' },
  })

  if (logo) {
    slide.addImage({
      data: logo,
      x: SLIDE_W - MARGIN - 1.7,
      y: 0.8,
      w: 1.7,
      h: 1.0,
      sizing: { type: 'contain', w: 1.7, h: 1.0 },
    })
  }

  const title =
    meeting?.client_company?.trim() ||
    meeting?.title?.trim() ||
    'Proposal'

  slide.addText('PROPOSAL', {
    x: MARGIN,
    y: 2.55,
    w: CONTENT_W,
    h: 0.45,
    fontFace: theme.majorFont,
    fontSize: 14,
    bold: true,
    color: theme.accent,
    charSpacing: 3,
  })

  slide.addText(title, {
    x: MARGIN - 0.03,
    y: 3.0,
    w: CONTENT_W - 1.5,
    h: 1.7,
    fontFace: theme.majorFont,
    fontSize: 42,
    bold: true,
    color: theme.ink,
    lineSpacingMultiple: 1.02,
    valign: 'top',
    fit: 'shrink',
  })

  // Optional secondary line: internal meeting title (when distinct) or deal value.
  const secondary = coverSecondary(meeting)
  if (secondary) {
    slide.addText(secondary, {
      x: MARGIN,
      y: 4.7,
      w: CONTENT_W,
      h: 0.5,
      fontFace: theme.minorFont,
      fontSize: 16,
      color: theme.muted,
    })
  }

  // Prepared-by block near the bottom.
  const company = profile?.company_name ?? profile?.full_name ?? 'PropMaker'
  const preparedRuns: PptxGenJS.TextProps[] = [
    { text: 'Prepared by ', options: { color: theme.muted, fontSize: 13 } },
    { text: company, options: { color: theme.ink, fontSize: 13, bold: true, breakLine: true } },
  ]
  if (profile?.tagline) {
    preparedRuns.push({
      text: profile.tagline,
      options: { color: theme.muted, fontSize: 11.5, breakLine: true },
    })
  }
  if (preparedOn) {
    preparedRuns.push({
      text: preparedOn,
      options: { color: theme.faint, fontSize: 10.5, breakLine: true },
    })
  }
  slide.addText(preparedRuns, {
    x: MARGIN,
    y: 5.85,
    w: CONTENT_W,
    h: 1.1,
    fontFace: theme.minorFont,
    valign: 'top',
  })
}

function coverSecondary(meeting: Meeting | null): string {
  if (!meeting) return ''
  // Show the internal title when it differs from the client company shown above.
  const title = meeting.title?.trim()
  const company = meeting.client_company?.trim()
  if (title && company && title.toLowerCase() !== company.toLowerCase()) return title
  if (meeting.client_value && meeting.client_value > 0) {
    return `Estimated value: ${new Intl.NumberFormat('en-US').format(meeting.client_value)}`
  }
  return ''
}

// --------------------------------------------------------------------------
// Content slides (text sections, with overflow → "(cont.)" slides)
// --------------------------------------------------------------------------

interface Para {
  runs: PptxGenJS.TextProps[]
  lines: number
}

/** Returns the number of slides added. */
function addContentSlides(
  pptx: PptxGenJS,
  section: ProposalSection,
  theme: Theme,
  remaining: number,
): number {
  if (remaining <= 0) return 0
  const paras = sectionParagraphs(section.nodes, theme)
  if (paras.length === 0 && !section.title) return 0

  // Chunk paragraphs into slides by the per-slide line budget, never splitting a
  // single paragraph (so list items and bullets stay intact).
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
    addSlideHeading(slide, section.title || 'Overview', i > 0, theme)
    const runs = chunk.flatMap((p) => p.runs)
    if (runs.length) {
      slide.addText(runs, {
        x: MARGIN,
        y: BODY_TOP,
        w: CONTENT_W,
        h: BODY_H,
        fontFace: theme.minorFont,
        color: theme.ink,
        valign: 'top',
        fit: 'shrink',
      })
    }
  })
  return capped.length
}

/** Section title with an accent underline rule. */
function addSlideHeading(
  slide: PptxGenJS.Slide,
  title: string,
  cont: boolean,
  theme: Theme,
) {
  slide.addText(cont ? `${title} (cont.)` : title, {
    x: MARGIN,
    y: 0.62,
    w: CONTENT_W,
    h: 0.6,
    fontFace: theme.majorFont,
    fontSize: 22,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })
  slide.addShape('rect', {
    x: MARGIN,
    y: 1.28,
    w: 0.9,
    h: 0.035,
    fill: { color: theme.accent },
    line: { type: 'none' },
  })
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
  // Rough chars-per-line for the content width at this font size, reduced by
  // list indentation. Always at least one line, plus a little paragraph spacing.
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
): number {
  if (remaining <= 0) return 0
  const rows = (tableNode.content ?? []).filter((n) => n.type === 'tableRow')
  if (rows.length === 0) {
    // No usable table — fall back to narrative text.
    return addContentSlides(pptx, section, theme, remaining)
  }

  const slide = pptx.addSlide({ masterName: 'PM_CONTENT' })
  addSlideHeading(slide, section.title || 'Line Items', false, theme)

  // Optional short intro: the section's leading paragraphs (before the table).
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
      x: MARGIN,
      y: BODY_TOP,
      w: CONTENT_W,
      h: introH,
      fontFace: theme.minorFont,
      color: theme.ink,
      valign: 'top',
      fit: 'shrink',
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
    x: MARGIN,
    y: tableY,
    w: CONTENT_W,
    colW,
    fontFace: theme.minorFont,
    fontSize: 11,
    color: theme.ink,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: theme.hairline },
    // NOTE: a table-level `margin` breaks pptxgenjs autoPage ("Array expected"),
    // so cell padding is set per-cell below instead.
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

/**
 * Fetch a public logo URL and return a data URI for pptxgenjs. Returns undefined
 * on any failure, non-raster type, or oversized image so the deck degrades to
 * text-only gracefully. pptxgenjs embeds raster formats (PNG/JPG/GIF) only.
 */
async function fetchLogoDataUri(url: string | null): Promise<string | undefined> {
  if (!url) return undefined
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!/image\/(png|jpe?g|gif)/.test(ct)) return undefined
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) return undefined
    const b64 = Buffer.from(bytes).toString('base64')
    return `data:${ct};base64,${b64}`
  } catch {
    return undefined
  }
}
