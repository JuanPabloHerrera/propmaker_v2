import type { TiptapDocument, TiptapNode } from '@/types'

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'horizontalRule',
])

export function tiptapToText(doc: TiptapDocument | null | undefined): string {
  if (!doc || !doc.content) return ''
  return walk(doc.content).trim()
}

/**
 * Strip empty text nodes anywhere in the tree — ProseMirror throws on them,
 * so a stored document containing `{type:'text',text:''}` would crash editor
 * creation on load. Shared by NotesPad and ProposalEditor.
 */
export function sanitizeDoc(doc: TiptapDocument): TiptapDocument {
  const visit = (n: TiptapNode): TiptapNode | null => {
    if (n.type === 'text') {
      return n.text && n.text.length > 0 ? n : null
    }
    if (n.content) {
      const cleaned = n.content.map(visit).filter((c): c is TiptapNode => c !== null)
      return { ...n, content: cleaned }
    }
    return n
  }
  return {
    type: 'doc',
    content: (doc.content ?? []).map(visit).filter((c): c is TiptapNode => c !== null),
  }
}

/** Flatten inline nodes to plain text, stripping all marks. */
export function inlineText(nodes: TiptapNode[] | undefined): string {
  if (!nodes) return ''
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text' && node.text) out += node.text
    else if (node.type === 'hardBreak') out += ' '
    else if (node.content) out += inlineText(node.content)
  }
  return out.trim()
}

export interface ProposalSection {
  /** The h2 heading text; '' for any nodes preceding the first h2 (preamble). */
  title: string
  /** The block nodes that belong to this section (excludes the h2 itself). */
  nodes: TiptapNode[]
}

/**
 * Split a proposal document into sections on level-2 (h2) headings. The AI
 * generates proposals with a fixed `##` skeleton, so these headings are the
 * natural slide boundaries for the PPTX export. Nodes before the first h2 are
 * grouped into a leading `''`-titled preamble section.
 */
export function tiptapToSections(
  doc: TiptapDocument | null | undefined,
): ProposalSection[] {
  if (!doc?.content) return []
  const sections: ProposalSection[] = []
  let current: ProposalSection = { title: '', nodes: [] }
  for (const node of doc.content) {
    if (node.type === 'heading' && Number(node.attrs?.level) === 2) {
      if (current.title || current.nodes.length) sections.push(current)
      current = { title: inlineText(node.content), nodes: [] }
    } else {
      current.nodes.push(node)
    }
  }
  if (current.title || current.nodes.length) sections.push(current)
  return sections
}

function walk(nodes: TiptapNode[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      out += node.text
      continue
    }
    if (node.type === 'hardBreak') {
      out += '\n'
      continue
    }
    if (node.content) out += walk(node.content)
    if (BLOCK_TYPES.has(node.type)) out += '\n'
  }
  return out
}

/**
 * Render a Tiptap document back into Markdown — used as the
 * source-of-truth payload when round-tripping through Claude for
 * refinement passes. Supports headings, paragraphs, bullet/ordered
 * lists, blockquotes, code blocks, horizontal rules, and tables.
 * Inline marks (bold/italic/code/link) are preserved.
 */
export function tiptapToMarkdown(doc: TiptapDocument | null | undefined): string {
  if (!doc || !doc.content) return ''
  return walkMd(doc.content, { listDepth: 0, ordered: false, orderedIndex: 0 }).trim()
}

interface MdCtx {
  listDepth: number
  ordered: boolean
  orderedIndex: number
}

function inlineMd(nodes: TiptapNode[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      let t = node.text
      const marks = node.marks ?? []
      for (const m of marks) {
        if (m.type === 'bold') t = `**${t}**`
        else if (m.type === 'italic') t = `*${t}*`
        else if (m.type === 'code') t = `\`${t}\``
        else if (m.type === 'link' && m.attrs && typeof m.attrs.href === 'string') {
          t = `[${t}](${m.attrs.href})`
        }
      }
      out += t
      continue
    }
    if (node.type === 'hardBreak') {
      out += '  \n'
      continue
    }
    if (node.content) out += inlineMd(node.content)
  }
  return out
}

function walkMd(nodes: TiptapNode[], ctx: MdCtx): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6)
        out += `${'#'.repeat(level)} ${inlineMd(node.content ?? [])}\n\n`
        break
      }
      case 'paragraph': {
        const txt = inlineMd(node.content ?? [])
        if (ctx.listDepth > 0) out += `${txt}\n`
        else out += `${txt}\n\n`
        break
      }
      case 'blockquote': {
        const inner = walkMd(node.content ?? [], ctx).trimEnd()
        out += inner
          .split('\n')
          .map((l) => (l ? `> ${l}` : '>'))
          .join('\n')
        out += '\n\n'
        break
      }
      case 'codeBlock': {
        const lang = (node.attrs?.language as string) ?? ''
        out += `\`\`\`${lang}\n${inlineMd(node.content ?? [])}\n\`\`\`\n\n`
        break
      }
      case 'horizontalRule': {
        out += '---\n\n'
        break
      }
      case 'bulletList': {
        out += walkMd(node.content ?? [], { ...ctx, listDepth: ctx.listDepth + 1, ordered: false }) + '\n'
        break
      }
      case 'orderedList': {
        out += walkMd(node.content ?? [], { ...ctx, listDepth: ctx.listDepth + 1, ordered: true, orderedIndex: 0 }) + '\n'
        break
      }
      case 'listItem': {
        const marker = ctx.ordered ? `${++ctx.orderedIndex}. ` : '- '
        const indent = '  '.repeat(Math.max(0, ctx.listDepth - 1))
        const inner = walkMd(node.content ?? [], { ...ctx, listDepth: ctx.listDepth })
          .trimEnd()
          .split('\n')
          .map((l, i) => (i === 0 ? `${indent}${marker}${l}` : `${indent}  ${l}`))
          .join('\n')
        out += `${inner}\n`
        break
      }
      case 'table': {
        const rows = (node.content ?? []).filter((n) => n.type === 'tableRow')
        if (rows.length === 0) break
        const renderRow = (row: TiptapNode) =>
          '| ' +
          (row.content ?? [])
            .map((cell) => inlineMd(cell.content ?? []).replace(/\|/g, '\\|').trim() || ' ')
            .join(' | ') +
          ' |'
        const headerRow = renderRow(rows[0])
        const colCount = (rows[0].content ?? []).length
        const separator = '| ' + new Array(colCount).fill('---').join(' | ') + ' |'
        const bodyRows = rows.slice(1).map(renderRow).join('\n')
        out += [headerRow, separator, bodyRows].filter(Boolean).join('\n') + '\n\n'
        break
      }
      default: {
        if (node.content) out += walkMd(node.content, ctx)
      }
    }
  }
  return out
}
