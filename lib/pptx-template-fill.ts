import { analyzePptxTemplate, type SlideInfo, type ShapeInfo } from '@/lib/pptx-template'
import { sectionToBlocks, type BodyBlock } from '@/lib/proposal-blocks'
import { tiptapToSections, inlineText } from '@/lib/tiptap'
import {
  EMU_PER_INCH,
  addContentTypeOverride,
  addSlideRel,
  appendShapeToSlide,
  buildBodyParagraphs,
  buildTableGraphicFrame,
  buildTitleParagraph,
  maxShapeId,
  nextRelId,
  nextSldId,
  replaceTxBodyParagraphs,
  setSldIdOrder,
  type TableStyleTokens,
} from '@/lib/pptx-ooxml'
import type { Meeting, PptxTheme, TiptapDocument, TiptapNode, UserProfile } from '@/types'

export class TemplateNotFillableError extends Error {}

export interface FillInput {
  templateBytes: ArrayBuffer | Buffer | Uint8Array
  proposal: { content_json: TiptapDocument | null }
  meeting: Meeting | null
  profile: UserProfile | null
  preparedOn?: string
  theme?: PptxTheme | null
}

const MAX_CONTENT_SLIDES = 60

/**
 * Produce a .pptx that reuses the template's actual slides (backgrounds, images,
 * layout) with the proposal's text swapped in. Throws TemplateNotFillableError
 * when the template can't be mapped, so the caller falls back to the theme-only
 * generator.
 */
export async function fillProposalIntoTemplate(input: FillInput): Promise<Buffer> {
  const model = await analyzePptxTemplate(input.templateBytes)
  if (!model) throw new TemplateNotFillableError('Template could not be analyzed')

  const { zip, slides, coverIndex, contentIndex, trailingIndexes } = model
  const cover = slides[coverIndex]
  const contentSource = slides[contentIndex]

  // Cover slide (edit in place): title + optional subtitle.
  const coverTitle =
    input.meeting?.client_company?.trim() || input.meeting?.title?.trim() || 'Proposal'
  const coverRepls: ShapeReplacement[] = []
  if (cover.titleShape) coverRepls.push({ shape: cover.titleShape, raw: fillTitle(cover.titleShape, coverTitle) })
  if (cover.subTitleShape) coverRepls.push({ shape: cover.subTitleShape, raw: fillTitle(cover.subTitleShape, preparedBy(input)) })
  zip.file(cover.partName, applyShapeReplacements(cover.xml, coverRepls))

  // Sections → content slides (skip the empty-title preamble).
  const sections = tiptapToSections(input.proposal.content_json).filter((s) => s.title.trim())
  if (sections.length === 0) throw new TemplateNotFillableError('Proposal has no sections')

  const tokens = tableTokens(input.theme)

  // Running package state.
  let contentTypesXml = model.contentTypesXml
  let presRelsXml = model.presentationRelsXml
  let sldIdCounter = nextSldId(model.presentationXml)
  let maxSlideNum = model.maxSlideNum

  // Ordered sldIdLst entries: cover first.
  const order: { id: string; rId: string }[] = [{ id: cover.sldId, rId: cover.rId }]

  // Whether we can reuse the content-source slide in place (it isn't the cover).
  const canReuseContentSource = contentIndex !== coverIndex
  let reusedContentSource = false

  const srcRels = (await zip.file(contentSource.relsPartName)?.async('string')) ?? null

  // Turn sections into slide specs, splitting long text sections across clean
  // "(cont.)" slides so no single slide is over-filled.
  const specs: SlideSpec[] = []
  for (const section of sections) {
    if (specs.length >= MAX_CONTENT_SLIDES) break
    const tableNode = section.nodes.find((n) => n.type === 'table')
    if (tableNode) {
      specs.push({ title: section.title, tableNode })
      continue
    }
    const chunks = chunkBlocks(sectionToBlocks(section.nodes), MAX_BODY_LINES)
    chunks.forEach((chunk, i) =>
      specs.push({ title: i === 0 ? section.title : `${section.title} (cont.)`, blocks: chunk }),
    )
  }

  for (const spec of specs.slice(0, MAX_CONTENT_SLIDES)) {
    const filledXml = buildSlideXml(contentSource, spec, tokens)

    if (canReuseContentSource && !reusedContentSource) {
      // First content section reuses the template's content slide (no orphan).
      zip.file(contentSource.partName, filledXml)
      order.push({ id: contentSource.sldId, rId: contentSource.rId })
      reusedContentSource = true
    } else {
      // Clone a fresh slide part from the content source.
      const m = ++maxSlideNum
      const partName = `ppt/slides/slide${m}.xml`
      const relsPartName = `ppt/slides/_rels/slide${m}.xml.rels`
      zip.file(partName, filledXml)
      if (srcRels) zip.file(relsPartName, srcRels)
      contentTypesXml = addContentTypeOverride(contentTypesXml, partName)
      const rId = nextRelId(presRelsXml)
      presRelsXml = addSlideRel(presRelsXml, rId, `slides/slide${m}.xml`)
      order.push({ id: String(sldIdCounter++), rId })
    }
  }

  // Trailing template slides kept verbatim.
  for (const ti of trailingIndexes) {
    order.push({ id: slides[ti].sldId, rId: slides[ti].rId })
  }

  const presentationXml = setSldIdOrder(model.presentationXml, order)

  zip.file('[Content_Types].xml', contentTypesXml)
  zip.file('ppt/_rels/presentation.xml.rels', presRelsXml)
  zip.file('ppt/presentation.xml', presentationXml)

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)
}

// --------------------------------------------------------------------------

interface SlideSpec {
  title: string
  blocks?: BodyBlock[]
  tableNode?: TiptapNode
}

// Per-slide body budget (approx. rendered lines) — kept low so slides stay clean.
const MAX_BODY_LINES = 10

function estLines(b: BodyBlock): number {
  const chars = b.runs.reduce((n, r) => n + r.text.length, 0)
  const cpl = b.isSubheading ? 55 : b.isList ? 72 : 88
  return Math.max(1, Math.ceil(chars / cpl)) + (b.isSubheading ? 1.2 : 0.6)
}

/** Split a section's blocks into slide-sized chunks (never splitting a block). */
function chunkBlocks(blocks: BodyBlock[], budget: number): BodyBlock[][] {
  const chunks: BodyBlock[][] = []
  let cur: BodyBlock[] = []
  let used = 0
  for (const b of blocks) {
    const l = estLines(b)
    if (cur.length && used + l > budget) {
      chunks.push(cur)
      cur = []
      used = 0
    }
    cur.push(b)
    used += l
  }
  if (cur.length) chunks.push(cur)
  return chunks.length ? chunks : [[]]
}

function buildSlideXml(source: SlideInfo, spec: SlideSpec, tokens: TableStyleTokens): string {
  const repls: ShapeReplacement[] = []
  if (source.titleShape) repls.push({ shape: source.titleShape, raw: fillTitle(source.titleShape, spec.title) })

  if (spec.tableNode) {
    // Table slide: clear the body placeholder, overlay a native table on it.
    if (source.bodyShape) {
      repls.push({
        shape: source.bodyShape,
        raw: replaceTxBodyParagraphs(source.bodyShape.raw, '<a:p><a:endParaRPr/></a:p>'),
      })
    }
    let xml = applyShapeReplacements(source.xml, repls)
    const region = source.bodyShape ?? defaultBodyRegion()
    const frame = buildTableFrame(spec.tableNode, region, maxShapeId(xml) + 1, tokens)
    if (frame) xml = appendShapeToSlide(xml, frame)
    return xml
  }

  if (source.bodyShape && spec.blocks) {
    repls.push({
      shape: source.bodyShape,
      raw: replaceTxBodyParagraphs(source.bodyShape.raw, buildBodyParagraphs(source.bodyShape.raw, spec.blocks)),
    })
  }
  return applyShapeReplacements(source.xml, repls)
}

interface ShapeReplacement {
  shape: ShapeInfo
  raw: string
}

/** Splice shape replacements into a slide, applied high→low offset so earlier
 * edits don't shift later shapes' positions. */
function applyShapeReplacements(slideXml: string, repls: ShapeReplacement[]): string {
  return [...repls]
    .sort((a, b) => b.shape.start - a.shape.start)
    .reduce((xml, r) => xml.slice(0, r.shape.start) + r.raw + xml.slice(r.shape.end), slideXml)
}

function fillTitle(shape: ShapeInfo, text: string): string {
  return replaceTxBodyParagraphs(shape.raw, buildTitleParagraph(shape.raw, text))
}

function preparedBy(input: FillInput): string {
  const company = input.profile?.company_name || input.profile?.full_name || 'PropMaker'
  return input.preparedOn ? `Prepared by ${company} · ${input.preparedOn}` : `Prepared by ${company}`
}

function defaultBodyRegion(): { leftEmu: number; topEmu: number; widthEmu: number; heightEmu: number } {
  return {
    leftEmu: Math.round(0.75 * EMU_PER_INCH),
    topEmu: Math.round(1.8 * EMU_PER_INCH),
    widthEmu: Math.round(11.83 * EMU_PER_INCH),
    heightEmu: Math.round(4.5 * EMU_PER_INCH),
  }
}

// --- table -----------------------------------------------------------------

function buildTableFrame(
  tableNode: TiptapNode,
  region: { leftEmu: number; topEmu: number; widthEmu: number; heightEmu: number },
  shapeId: number,
  tokens: TableStyleTokens,
): string | null {
  const rows = extractTableRows(tableNode)
  if (rows.length === 0) return null
  const headers = rows[0]
  const weights = headers.map((h) =>
    /description|scope|detail|notes|summary/i.test(h) ? 2.8 : /item|service|deliverable|name|product/i.test(h) ? 1.5 : 1,
  )
  const total = weights.reduce((a, b) => a + b, 0) || headers.length
  const colWidthsEmu = weights.map((w) => (region.widthEmu * w) / total)
  const rightAlign = headers.map((h) => /price|amount|total|cost|qty|quantity|rate|value|subtotal/i.test(h))
  return buildTableGraphicFrame({
    rows,
    colWidthsEmu,
    rightAlign,
    xEmu: region.leftEmu,
    yEmu: region.topEmu,
    wEmu: region.widthEmu,
    hEmu: region.heightEmu,
    shapeId,
    tokens,
  })
}

function extractTableRows(tableNode: TiptapNode): string[][] {
  const rows = (tableNode.content ?? []).filter((n) => n.type === 'tableRow')
  return rows.map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((block) => inlineText(block.content))
        .filter(Boolean)
        .join(' ')
        .trim(),
    ),
  )
}

function tableTokens(theme: PptxTheme | null | undefined): TableStyleTokens {
  const accent = clean(theme?.accent, '4D8A6B')
  const ink = clean(theme?.ink, '2B2620')
  const zebra: [string, string] = [clean(theme?.zebra?.[0], 'FBFAF7'), clean(theme?.zebra?.[1], 'FFFFFF')]
  const font = theme?.minorFont || theme?.majorFont || 'Arial'
  return { accent, ink, zebra, font, headerText: readableOn(accent) }
}

function clean(hex: string | undefined, fallback: string): string {
  return hex && /^#?[0-9a-f]{3,6}$/i.test(hex) ? hex.replace('#', '').toUpperCase() : fallback
}

function readableOn(fill: string): string {
  const h = fill.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '111111' : 'FFFFFF'
}
