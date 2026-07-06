import { inlineText } from '@/lib/tiptap'
import type { TiptapNode } from '@/types'

// Framework-neutral representation of a proposal section's body, used by the
// OOXML template-fill emitters (and available to any other renderer). Mirrors the
// traversal in lib/pptx.ts's walkBlocks but emits plain data instead of pptxgenjs
// options.

export interface BodyRun {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  href?: string
}

export interface BodyBlock {
  runs: BodyRun[]
  /** 0 when not in a list. */
  listDepth: number
  ordered: boolean
  isList: boolean
  isQuote: boolean
  isSubheading: boolean
  isCode: boolean
}

interface ListCtx {
  depth: number
  ordered: boolean
}

/** Convert a section's block nodes into ordered BodyBlocks (tables excluded). */
export function sectionToBlocks(nodes: TiptapNode[] | undefined): BodyBlock[] {
  const out: BodyBlock[] = []
  walk(nodes, out, null, false)
  return out
}

function block(runs: BodyRun[], extra: Partial<BodyBlock>): BodyBlock {
  return {
    runs,
    listDepth: 0,
    ordered: false,
    isList: false,
    isQuote: false,
    isSubheading: false,
    isCode: false,
    ...extra,
  }
}

function walk(
  nodes: TiptapNode[] | undefined,
  out: BodyBlock[],
  list: ListCtx | null,
  quote: boolean,
): void {
  for (const node of nodes ?? []) {
    switch (node.type) {
      case 'heading': {
        if (!inlineText(node.content)) break
        out.push(block(inlineRuns(node.content), { isSubheading: true }))
        break
      }
      case 'paragraph': {
        if (!inlineText(node.content)) break
        out.push(
          block(inlineRuns(node.content), {
            listDepth: list ? list.depth : 0,
            ordered: !!list?.ordered,
            isList: !!list,
            isQuote: quote,
          }),
        )
        break
      }
      case 'bulletList':
        walk(node.content, out, { depth: (list?.depth ?? -1) + 1, ordered: false }, quote)
        break
      case 'orderedList':
        walk(node.content, out, { depth: (list?.depth ?? -1) + 1, ordered: true }, quote)
        break
      case 'listItem':
        walk(node.content, out, list, quote)
        break
      case 'blockquote':
        walk(node.content, out, list, true)
        break
      case 'codeBlock': {
        const text = inlineText(node.content)
        if (!text) break
        out.push(block([{ text, code: true }], { isCode: true }))
        break
      }
      // horizontalRule / table / others: skipped
      default:
        break
    }
  }
}

/** Inline nodes → runs carrying mark info (bold/italic/code/link). */
function inlineRuns(nodes: TiptapNode[] | undefined): BodyRun[] {
  const runs: BodyRun[] = []
  for (const node of nodes ?? []) {
    if (node.type === 'text' && node.text) {
      const run: BodyRun = { text: node.text }
      for (const m of node.marks ?? []) {
        if (m.type === 'bold') run.bold = true
        else if (m.type === 'italic') run.italic = true
        else if (m.type === 'code') run.code = true
        else if (m.type === 'link' && typeof m.attrs?.href === 'string') run.href = m.attrs.href as string
      }
      runs.push(run)
    } else if (node.content) {
      runs.push(...inlineRuns(node.content))
    }
  }
  if (runs.length === 0) runs.push({ text: '' })
  return runs
}
