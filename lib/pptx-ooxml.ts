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

/**
 * Body paragraphs from neutral BodyBlocks. Reuses the shape's run props (font /
 * size / color) so text matches the template; bullets come from a minimal pPr so
 * list levels/plain paragraphs render correctly regardless of the placeholder's
 * default list style. (Per-run bold/italic is a v2 enhancement — text is flattened
 * to one run here.)
 */
export function buildBodyParagraphs(shapeXml: string, blocks: BodyBlock[]): string {
  const rPr = firstRunProps(shapeXml)
  if (blocks.length === 0) return `<a:p>${firstParaProps(shapeXml)}<a:endParaRPr/></a:p>`
  return blocks
    .map((b) => {
      const text = b.runs.map((r) => r.text).join('')
      const runProps = b.isCode ? monoRunProps(rPr) : rPr
      const run = `<a:r>${runProps}<a:t>${xmlEscape(text)}</a:t></a:r>`
      return `<a:p>${buildParaProps(b)}${run}</a:p>`
    })
    .join('')
}

function monoRunProps(rPr: string): string {
  // Ensure a Courier New latin typeface inside the rPr.
  if (/\/>$/.test(rPr)) return rPr.replace(/\/>$/, '><a:latin typeface="Courier New"/></a:rPr>')
  if (/<a:latin\b/.test(rPr)) return rPr.replace(/<a:latin\b[^>]*\/>/, '<a:latin typeface="Courier New"/>')
  return rPr.replace('</a:rPr>', '<a:latin typeface="Courier New"/></a:rPr>')
}

function buildParaProps(b: BodyBlock): string {
  const attrs: string[] = []
  if (b.isList && b.listDepth > 0) attrs.push(`lvl="${Math.min(b.listDepth, 8)}"`)
  let bullet = ''
  if (b.isList) {
    if (b.ordered) bullet = '<a:buAutoNum type="arabicPeriod"/>'
    // bullet lists use the placeholder level's default glyph → no override
  } else {
    bullet = '<a:buNone/>' // plain paragraphs & subheadings: no bullet
  }
  return `<a:pPr${attrs.length ? ' ' + attrs.join(' ') : ''}>${bullet}</a:pPr>`
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
