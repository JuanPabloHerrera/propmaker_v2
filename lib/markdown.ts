import type { TiptapDocument, TiptapNode } from '@/types'

// Minimal markdown → Tiptap doc converter for proposal output.
// Covers what `generateProposal` actually emits: headings (#, ##, ###),
// bullet lists (-, *), paragraphs, bold (**), italic (*), inline code (`),
// a horizontal rule (---), and GitHub-style pipe tables (Timeline & Line Items).
// Tables become real Tiptap table nodes (same shape as ProposalEditor's
// `upgradeLegacyTables`) so freshly-generated proposals store native tables —
// the editor renders them and the PPTX export emits a native table slide without
// waiting for the user to open/edit the doc first.

function parseInline(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = []
  let rest = text

  while (rest.length > 0) {
    // **bold**
    const bold = rest.match(/^\*\*(.+?)\*\*/)
    if (bold) {
      nodes.push({ type: 'text', text: bold[1], marks: [{ type: 'bold' }] })
      rest = rest.slice(bold[0].length)
      continue
    }
    // *italic* — guard against accidentally matching ** start
    const italic = rest.match(/^\*([^*]+?)\*/)
    if (italic) {
      nodes.push({ type: 'text', text: italic[1], marks: [{ type: 'italic' }] })
      rest = rest.slice(italic[0].length)
      continue
    }
    // `inline code`
    const code = rest.match(/^`([^`]+)`/)
    if (code) {
      nodes.push({ type: 'text', text: code[1], marks: [{ type: 'code' }] })
      rest = rest.slice(code[0].length)
      continue
    }
    // Plain text up to the next special character
    const next = rest.search(/(\*\*|\*|`)/)
    if (next < 0) {
      nodes.push({ type: 'text', text: rest })
      break
    }
    if (next > 0) {
      nodes.push({ type: 'text', text: rest.slice(0, next) })
    }
    rest = rest.slice(next)
    // If the special char didn't match a closing pair, emit it as plain text
    // and advance one char to avoid an infinite loop.
    if (
      !rest.match(/^\*\*(.+?)\*\*/) &&
      !rest.match(/^\*([^*]+?)\*/) &&
      !rest.match(/^`([^`]+)`/)
    ) {
      nodes.push({ type: 'text', text: rest[0] })
      rest = rest.slice(1)
    }
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', text }]
}

// ── Pipe tables ─────────────────────────────────────────────────────

function splitTableRow(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  if (!line.includes('|')) return false
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c))
}

// ProseMirror rejects empty text nodes, so an empty cell holds a bare paragraph.
function cellParagraph(text: string): TiptapNode {
  const t = text.trim()
  return t.length > 0 ? { type: 'paragraph', content: parseInline(t) } : { type: 'paragraph' }
}

function buildTable(headerCells: string[], bodyRows: string[][]): TiptapNode {
  const cols = headerCells.length
  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: headerCells.map((c) => ({ type: 'tableHeader', content: [cellParagraph(c)] })),
      },
      ...bodyRows.map<TiptapNode>((cells) => {
        const padded = cells.slice(0, cols)
        while (padded.length < cols) padded.push('')
        return {
          type: 'tableRow',
          content: padded.map((c) => ({ type: 'tableCell', content: [cellParagraph(c)] })),
        }
      }),
    ],
  }
}

export function markdownToTiptap(markdown: string): TiptapDocument {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const content: TiptapNode[] = []
  let listBuffer: TiptapNode[] | null = null

  const flushList = () => {
    if (listBuffer && listBuffer.length > 0) {
      content.push({ type: 'bulletList', content: listBuffer })
    }
    listBuffer = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '')

    // GitHub-style pipe table: a header row followed by a `|---|---|` separator.
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushList()
      const headerCells = splitTableRow(line)
      i += 1 // consume separator
      const bodyRows: string[][] = []
      while (i + 1 < lines.length) {
        const peek = lines[i + 1]
        if (!peek.trim() || !peek.includes('|')) break
        bodyRows.push(splitTableRow(peek))
        i += 1
      }
      content.push(buildTable(headerCells, bodyRows))
      continue
    }

    if (!line.trim()) {
      flushList()
      continue
    }

    if (line.match(/^-{3,}$/)) {
      flushList()
      content.push({ type: 'horizontalRule' })
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushList()
      const level = heading[1].length
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInline(heading[2]),
      })
      continue
    }

    const bullet = line.match(/^[\s]*[-*]\s+(.+)$/)
    if (bullet) {
      listBuffer ??= []
      listBuffer.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInline(bullet[1]) }],
      })
      continue
    }

    // Plain paragraph
    flushList()
    content.push({ type: 'paragraph', content: parseInline(line) })
  }
  flushList()

  return { type: 'doc', content }
}
