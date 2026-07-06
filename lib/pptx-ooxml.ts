import type { BodyBlock } from '@/lib/proposal-blocks'

// ---------------------------------------------------------------------------
// OOXML string surgery for the template-fill export: rewrite text inside a
// shape's <p:txBody> while preserving all other bytes (backgrounds, images,
// formatting), build a native <a:tbl> graphic frame, and small helpers for
// cloning/registering slide parts. All buffer/string based — no XML lib.
// ---------------------------------------------------------------------------

export const EMU_PER_INCH = 914400

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// --- run/paragraph templates pulled from the source shape -------------------

/** The first run's <a:rPr> (or a sensible fallback) — carries font/size/color. */
export function firstRunProps(shapeXml: string): string {
  const run = /<a:r>\s*(<a:rPr\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/a:rPr>))/.exec(shapeXml)
  if (run) return run[1]
  const endp = /<a:endParaRPr\b([^>]*?)(\/>|>[\s\S]*?<\/a:endParaRPr>)/.exec(shapeXml)
  if (endp) {
    const inner = endp[2] === '/>' ? '/>' : endp[2].replace(/^>/, '>').replace(/<\/a:endParaRPr>$/, '</a:rPr>')
    return `<a:rPr${endp[1]}${endp[2] === '/>' ? '/>' : inner}`
  }
  return '<a:rPr lang="en-US"/>'
}

/** The first paragraph's <a:pPr> (alignment etc.), or '' if none. */
export function firstParaProps(shapeXml: string): string {
  const m = /<a:pPr\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/a:pPr>)/.exec(shapeXml)
  return m ? m[0] : ''
}

/** Replace the <a:p> paragraphs inside a shape's txBody, keeping bodyPr/lstStyle. */
export function replaceTxBodyParagraphs(shapeXml: string, paragraphsXml: string): string {
  const txStart = shapeXml.indexOf('<p:txBody')
  const txEnd = shapeXml.indexOf('</p:txBody>')
  if (txStart < 0 || txEnd < 0) return shapeXml
  const inner = shapeXml.slice(txStart, txEnd)
  const pMatch = /<a:p[\s>/]/.exec(inner)
  const newInner = pMatch ? inner.slice(0, pMatch.index) + paragraphsXml : inner + paragraphsXml
  return shapeXml.slice(0, txStart) + newInner + shapeXml.slice(txEnd)
}

// --- paragraph builders -----------------------------------------------------

/** One title paragraph reusing the shape's own run + paragraph formatting. */
export function buildTitleParagraph(shapeXml: string, text: string): string {
  const rPr = firstRunProps(shapeXml)
  const pPr = firstParaProps(shapeXml)
  return `<a:p>${pPr}<a:r>${rPr}<a:t>${xmlEscape(text)}</a:t></a:r></a:p>`
}

// Readability targets (1/100 pt). We cap at the template's own body size so we
// never enlarge text — only make it smaller and cleaner.
const BODY_SZ = 1400
const LIST_SZ = 1300
const SUBHEAD_SZ = 1600

/**
 * Body paragraphs from neutral BodyBlocks — readable & clean: keeps the
 * template's font family + color, but uses smaller controlled sizes, per-run
 * bold/italic/code, a visual hierarchy for sub-headings, and paragraph/line
 * spacing so slides breathe.
 */
export function buildBodyParagraphs(shapeXml: string, blocks: BodyBlock[]): string {
  const baseRpr = firstRunProps(shapeXml)
  const tsz = extractSz(baseRpr) ?? 1800
  if (blocks.length === 0) return `<a:p>${firstParaProps(shapeXml)}<a:endParaRPr/></a:p>`
  return blocks
    .map((b) => {
      const sz = Math.min(tsz, b.isSubheading ? SUBHEAD_SZ : b.isList ? LIST_SZ : BODY_SZ)
      const runsXml = b.runs
        .map((r) => {
          const rpr = deriveRunProps(baseRpr, {
            sz,
            bold: b.isSubheading || !!r.bold,
            italic: !!r.italic || b.isQuote,
            code: !!r.code || b.isCode,
          })
          return `<a:r>${rpr}<a:t>${xmlEscape(r.text)}</a:t></a:r>`
        })
        .join('')
      return `<a:p>${buildParaProps(b)}${runsXml}</a:p>`
    })
    .join('')
}

/** Derive a run's <a:rPr> from the template base: set size + bold/italic/mono,
 * preserving the template's font family and color. */
function deriveRunProps(
  baseRpr: string,
  o: { sz: number; bold: boolean; italic: boolean; code: boolean },
): string {
  const m = /^<a:rPr\b([^>]*?)(\/?)>/.exec(baseRpr)
  if (!m) return `<a:rPr lang="en-US" sz="${o.sz}"${o.bold ? ' b="1"' : ''}${o.italic ? ' i="1"' : ''}/>`
  let attrs = m[1]
  let inner = m[2] === '/' ? '' : baseRpr.slice(m[0].length).replace(/<\/a:rPr>\s*$/, '')
  attrs = setAttr(attrs, 'sz', String(o.sz))
  attrs = o.bold ? setAttr(attrs, 'b', '1') : removeAttr(attrs, 'b')
  attrs = o.italic ? setAttr(attrs, 'i', '1') : removeAttr(attrs, 'i')
  if (o.code) {
    inner = /<a:latin\b/.test(inner)
      ? inner.replace(/<a:latin\b[^>]*\/>/, '<a:latin typeface="Courier New"/>')
      : inner + '<a:latin typeface="Courier New"/>'
  }
  return inner.trim() ? `<a:rPr${attrs}>${inner}</a:rPr>` : `<a:rPr${attrs}/>`
}

function setAttr(attrs: string, name: string, val: string): string {
  const stripped = removeAttr(attrs, name)
  return `${stripped} ${name}="${val}"`
}

function removeAttr(attrs: string, name: string): string {
  return attrs.replace(new RegExp(`\\s*\\b${name}="[^"]*"`, 'g'), '')
}

function extractSz(rpr: string): number | null {
  const m = /\bsz="(\d+)"/.exec(rpr)
  return m ? Number(m[1]) : null
}

/** Paragraph props with correct OOXML child order: lnSpc → spcBef → spcAft → bullet. */
function buildParaProps(b: BodyBlock): string {
  const attrs = b.isList && b.listDepth > 0 ? ` lvl="${Math.min(b.listDepth, 8)}"` : ''
  const spcBef = b.isSubheading ? 1000 : b.isList ? 200 : 500
  const spcAft = b.isList ? 200 : 600
  const spacing =
    `<a:lnSpc><a:spcPct val="112000"/></a:lnSpc>` +
    `<a:spcBef><a:spcPts val="${spcBef}"/></a:spcBef>` +
    `<a:spcAft><a:spcPts val="${spcAft}"/></a:spcAft>`
  let bullet = ''
  if (b.isList) {
    if (b.ordered) bullet = '<a:buAutoNum type="arabicPeriod"/>'
    // bullet lists inherit the placeholder level's default glyph
  } else {
    bullet = '<a:buNone/>' // plain paragraphs & sub-headings: no bullet
  }
  return `<a:pPr${attrs}>${spacing}${bullet}</a:pPr>`
}

// --- native table (graphicFrame) -------------------------------------------

export interface TableStyleTokens {
  accent: string // header fill (hex, no #)
  ink: string
  zebra: [string, string]
  font: string
  headerText: string
}

export interface TableFrameOpts {
  rows: string[][] // rows[0] = header
  colWidthsEmu: number[]
  rightAlign: boolean[]
  xEmu: number
  yEmu: number
  wEmu: number
  hEmu: number
  shapeId: number
  tokens: TableStyleTokens
}

export function buildTableGraphicFrame(o: TableFrameOpts): string {
  const rowH = Math.max(274638, Math.floor(o.hEmu / Math.max(o.rows.length, 1)))
  const grid = o.colWidthsEmu.map((w) => `<a:gridCol w="${Math.max(1, Math.round(w))}"/>`).join('')
  const rowsXml = o.rows
    .map((cells, ri) => {
      const header = ri === 0
      const fill = header ? o.tokens.accent : ri % 2 === 0 ? o.tokens.zebra[0] : o.tokens.zebra[1]
      const color = header ? o.tokens.headerText : o.tokens.ink
      const tcs = cells
        .map((text, ci) => {
          const algn = o.rightAlign[ci] ? ' algn="r"' : ' algn="l"'
          const rpr = `<a:rPr lang="en-US" sz="1100"${header ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${xmlEscape(o.tokens.font)}"/></a:rPr>`
          return (
            `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>` +
            `<a:p><a:pPr${algn}/><a:r>${rpr}<a:t>${xmlEscape(text)}</a:t></a:r></a:p>` +
            `</a:txBody><a:tcPr marL="45720" marR="45720" marT="27432" marB="27432" anchor="ctr">` +
            `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></a:tcPr></a:tc>`
          )
        })
        .join('')
      return `<a:tr h="${rowH}">${tcs}</a:tr>`
    })
    .join('')
  return (
    `<p:graphicFrame><p:nvGraphicFramePr>` +
    `<p:cNvPr id="${o.shapeId}" name="LineItems"/>` +
    `<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/>` +
    `</p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${o.xEmu}" y="${o.yEmu}"/><a:ext cx="${o.wEmu}" cy="${o.hEmu}"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
    `<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${grid}</a:tblGrid>${rowsXml}</a:tbl>` +
    `</a:graphicData></a:graphic></p:graphicFrame>`
  )
}

/** Insert new shape XML just before </p:spTree>. */
export function appendShapeToSlide(slideXml: string, shapeXml: string): string {
  const idx = slideXml.lastIndexOf('</p:spTree>')
  if (idx < 0) return slideXml
  return slideXml.slice(0, idx) + shapeXml + slideXml.slice(idx)
}

// --- package registration helpers ------------------------------------------

export function maxShapeId(slideXml: string): number {
  const ids = [...slideXml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map((m) => Number(m[1]))
  return ids.length ? Math.max(...ids) : 1
}

export function nextRelId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/\bId="rId(\d+)"/g)].map((m) => Number(m[1]))
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`
}

export function nextSldId(presentationXml: string): number {
  const ids = [...presentationXml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map((m) => Number(m[1]))
  return Math.max(256, (ids.length ? Math.max(...ids) : 255) + 1)
}

export function addContentTypeOverride(contentTypesXml: string, partName: string): string {
  const override = `<Override PartName="/${partName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  return contentTypesXml.replace('</Types>', `${override}</Types>`)
}

export function addSlideRel(relsXml: string, rId: string, target: string): string {
  const rel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${target}"/>`
  return relsXml.replace('</Relationships>', `${rel}</Relationships>`)
}

/** Replace the whole <p:sldIdLst> with the given ordered [{id, rId}] entries. */
export function setSldIdOrder(presentationXml: string, entries: { id: string; rId: string }[]): string {
  const lst = `<p:sldIdLst>${entries.map((e) => `<p:sldId id="${e.id}" r:id="${e.rId}"/>`).join('')}</p:sldIdLst>`
  if (/<p:sldIdLst\b[\s\S]*?<\/p:sldIdLst>/.test(presentationXml)) {
    return presentationXml.replace(/<p:sldIdLst\b[\s\S]*?<\/p:sldIdLst>/, lst)
  }
  if (/<p:sldIdLst\b[^>]*\/>/.test(presentationXml)) {
    return presentationXml.replace(/<p:sldIdLst\b[^>]*\/>/, lst)
  }
  return presentationXml
}
