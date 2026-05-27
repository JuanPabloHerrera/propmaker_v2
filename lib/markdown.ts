import type { TiptapDocument, TiptapNode } from '@/types'

// Minimal markdown → Tiptap doc converter for proposal output.
// Covers what `generateProposal` actually emits: headings (#, ##, ###),
// bullet lists (-, *), paragraphs, bold (**), italic (*), inline code (`),
// and a horizontal rule (---). Tables and other rich constructs degrade to
// paragraphs of plain text (which is fine — the user can edit in Tiptap after).

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

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

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
