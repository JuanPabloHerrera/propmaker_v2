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
