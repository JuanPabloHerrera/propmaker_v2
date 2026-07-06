import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// Analyze a .pptx template into an ordered structural model so the fill step
// can reuse its real slides (backgrounds, images, layout) and swap only text.
// Pure string/regex over OOXML — no XML lib, buffer-native (same style as
// lib/pptx-theme.ts). Returns null when the deck can't be mapped, so the caller
// falls back to the theme-only generator.
// ---------------------------------------------------------------------------

export type PhType = 'title' | 'ctrTitle' | 'subTitle' | 'body' | 'other'

export interface ShapeInfo {
  kind: 'sp' | 'pic' | 'graphicFrame'
  raw: string
  start: number
  end: number
  phType: PhType | null
  hasTxBody: boolean
  topEmu: number
  leftEmu: number
  widthEmu: number
  heightEmu: number
  maxFontSz: number // 1/100 pt
  textLen: number
}

export interface SlideInfo {
  partName: string // ppt/slides/slide3.xml
  relsPartName: string // ppt/slides/_rels/slide3.xml.rels
  slideNum: number
  sldId: string
  rId: string
  xml: string
  shapes: ShapeInfo[]
  hasImages: boolean
  titleShape?: ShapeInfo
  bodyShape?: ShapeInfo
  subTitleShape?: ShapeInfo
}

export interface TemplateModel {
  zip: JSZip
  slides: SlideInfo[] // in presentation (sldIdLst) order
  coverIndex: number
  contentIndex: number
  trailingIndexes: number[]
  contentTypesXml: string
  presentationXml: string
  presentationRelsXml: string
  maxSlideNum: number
}

export async function analyzePptxTemplate(
  bytes: ArrayBuffer | Buffer | Uint8Array,
): Promise<TemplateModel | null> {
  try {
    const zip = await JSZip.loadAsync(bytes)
    const presentationXml = await readStr(zip, 'ppt/presentation.xml')
    const presentationRelsXml = await readStr(zip, 'ppt/_rels/presentation.xml.rels')
    const contentTypesXml = await readStr(zip, '[Content_Types].xml')
    if (!presentationXml || !presentationRelsXml || !contentTypesXml) return null

    // Slide order: sldIdLst → r:id → rels target.
    const relTargets = parseRels(presentationRelsXml) // rId → target (relative to ppt/)
    const sldIds = [...presentationXml.matchAll(/<p:sldId\b[^>]*\bid="([^"]+)"[^>]*\br:id="([^"]+)"[^>]*\/?>/g)]
    if (sldIds.length === 0) return null

    const slides: SlideInfo[] = []
    let maxSlideNum = 0
    for (const key of Object.keys(zip.files)) {
      const m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(key)
      if (m) maxSlideNum = Math.max(maxSlideNum, Number(m[1]))
    }

    for (const sm of sldIds) {
      const sldId = sm[1]
      const rId = sm[2]
      const target = relTargets[rId]
      if (!target) continue
      const partName = normalizeTarget(target)
      const xml = await readStr(zip, partName)
      if (!xml) continue
      const numM = /slide(\d+)\.xml$/.exec(partName)
      const slideNum = numM ? Number(numM[1]) : 0
      const relsPartName = partName.replace(/slides\/slide(\d+)\.xml$/, 'slides/_rels/slide$1.xml.rels')
      slides.push(classifySlide({ partName, relsPartName, slideNum, sldId, rId, xml }))
    }
    if (slides.length === 0) return null

    // Need at least one slide with a title or body target somewhere.
    const anyTarget = slides.some((s) => s.titleShape || s.bodyShape || s.subTitleShape)
    if (!anyTarget) return null

    const coverIndex = pickCover(slides)
    const contentIndex = pickContent(slides, coverIndex)
    const trailingIndexes: number[] = []
    for (let i = 0; i < slides.length; i++) {
      if (i !== coverIndex && i !== contentIndex && i > contentIndex) trailingIndexes.push(i)
    }

    return {
      zip,
      slides,
      coverIndex,
      contentIndex,
      trailingIndexes,
      contentTypesXml,
      presentationXml,
      presentationRelsXml,
      maxSlideNum,
    }
  } catch {
    return null
  }
}

// --------------------------------------------------------------------------
// Slide classification
// --------------------------------------------------------------------------

function classifySlide(base: Omit<SlideInfo, 'shapes' | 'hasImages'>): SlideInfo {
  const { xml } = base
  const shapes: ShapeInfo[] = [
    ...findElements(xml, 'p:sp').map((e) => shapeInfo(e, 'sp')),
    ...findElements(xml, 'p:pic').map((e) => shapeInfo(e, 'pic')),
    ...findElements(xml, 'p:graphicFrame').map((e) => shapeInfo(e, 'graphicFrame')),
  ].sort((a, b) => a.start - b.start)

  const hasImages = /<p:pic\b/.test(xml) || /<a:blip\b/.test(xml)

  const textShapes = shapes.filter((s) => s.kind === 'sp' && s.hasTxBody)

  // Placeholder-driven picks.
  let titleShape = textShapes.find((s) => s.phType === 'title' || s.phType === 'ctrTitle')
  const subTitleShape = textShapes.find((s) => s.phType === 'subTitle')
  let bodyShape = textShapes
    .filter((s) => s.phType === 'body')
    .sort((a, b) => area(b) - area(a))[0]

  // Heuristic fallback when placeholders are absent.
  if (!titleShape && textShapes.length > 0) {
    titleShape = [...textShapes].sort(
      (a, b) => b.maxFontSz - a.maxFontSz || a.topEmu - b.topEmu,
    )[0]
  }
  if (!bodyShape) {
    bodyShape = textShapes
      .filter((s) => s !== titleShape && s !== subTitleShape)
      .sort((a, b) => area(b) - area(a) || b.textLen - a.textLen)[0]
  }

  return { ...base, shapes, hasImages, titleShape, bodyShape, subTitleShape }
}

function shapeInfo(e: { raw: string; start: number; end: number }, kind: ShapeInfo['kind']): ShapeInfo {
  const { raw, start, end } = e
  const phM = /<p:ph\b([^>]*)\/?>/.exec(raw)
  let phType: PhType | null = null
  if (phM) {
    const t = /\btype="([^"]+)"/.exec(phM[1])?.[1]
    phType = (t as PhType) ?? 'body' // a bare <p:ph/> defaults to body
  }
  const off = /<a:off\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/.exec(raw)
  const ext = /<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(raw)
  const fonts = [...raw.matchAll(/\bsz="(\d+)"/g)].map((m) => Number(m[1]))
  const textLen = [...raw.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].reduce((n, m) => n + m[1].length, 0)
  return {
    kind,
    raw,
    start,
    end,
    phType,
    hasTxBody: /<p:txBody\b/.test(raw),
    leftEmu: off ? Number(off[1]) : 0,
    topEmu: off ? Number(off[2]) : 0,
    widthEmu: ext ? Number(ext[1]) : 0,
    heightEmu: ext ? Number(ext[2]) : 0,
    maxFontSz: fonts.length ? Math.max(...fonts) : 0,
    textLen,
  }
}

function area(s: ShapeInfo): number {
  return s.widthEmu * s.heightEmu
}

function pickCover(slides: SlideInfo[]): number {
  const idx = slides.findIndex((s) =>
    s.shapes.some((sh) => sh.phType === 'ctrTitle' || sh.phType === 'subTitle'),
  )
  return idx >= 0 ? idx : 0
}

function pickContent(slides: SlideInfo[], coverIndex: number): number {
  for (let i = 0; i < slides.length; i++) {
    if (i === coverIndex) continue
    if (i > coverIndex && slides[i].titleShape && slides[i].bodyShape) return i
  }
  // else the first slide after cover, else cover itself (single-slide template)
  if (coverIndex + 1 < slides.length) return coverIndex + 1
  return coverIndex
}

// --------------------------------------------------------------------------
// OOXML / zip helpers
// --------------------------------------------------------------------------

async function readStr(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path)
  return f ? f.async('string') : null
}

function parseRels(relsXml: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g)) {
    out[m[1]] = m[2]
  }
  return out
}

/** Resolve a presentation-rels Target (e.g. "slides/slide1.xml") to a zip path. */
function normalizeTarget(target: string): string {
  const t = target.replace(/^\.\//, '')
  if (t.startsWith('/')) return t.slice(1)
  return `ppt/${t}`.replace(/ppt\/\.\.\//, '')
}

/** Find all top-level occurrences of an element (nesting- and self-close-aware). */
export function findElements(
  xml: string,
  localTag: string,
): { raw: string; start: number; end: number }[] {
  const results: { raw: string; start: number; end: number }[] = []
  const openRe = new RegExp(`<${escapeTag(localTag)}(?=[\\s/>])`, 'g')
  let m: RegExpExecArray | null
  while ((m = openRe.exec(xml))) {
    const end = matchElementEnd(xml, m.index, localTag)
    if (end < 0) break
    results.push({ raw: xml.slice(m.index, end), start: m.index, end })
    openRe.lastIndex = end
  }
  return results
}

function matchElementEnd(xml: string, startIdx: number, tag: string): number {
  let gt = xml.indexOf('>', startIdx)
  if (gt < 0) return -1
  if (xml[gt - 1] === '/') return gt + 1 // self-closing
  const openRe = new RegExp(`<${escapeTag(tag)}(?=[\\s/>])`, 'g')
  const closeRe = new RegExp(`</${escapeTag(tag)}>`, 'g')
  let depth = 1
  let i = gt + 1
  while (depth > 0) {
    openRe.lastIndex = i
    closeRe.lastIndex = i
    const o = openRe.exec(xml)
    const c = closeRe.exec(xml)
    if (!c) return -1
    if (o && o.index < c.index) {
      const ogt = xml.indexOf('>', o.index)
      if (ogt >= 0 && xml[ogt - 1] !== '/') depth++
      i = ogt + 1
    } else {
      depth--
      i = c.index + c[0].length
    }
  }
  return i
}

function escapeTag(tag: string): string {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
