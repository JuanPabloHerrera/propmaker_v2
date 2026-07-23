'use client'

import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import type { TiptapDocument, TiptapNode } from '@/types'
import type { OutlineSection } from './OutlineSidebar'

interface Props {
  documentId: string
  initialContent?: string
  initialJson?: TiptapDocument | null
  onSectionsChange?: (sections: OutlineSection[]) => void
  readOnly?: boolean
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineMarkdownToHTML(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function splitRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  const cells = splitRow(line)
  if (cells.length === 0) return false
  return cells.every((c) => /^:?-{3,}:?$/.test(c))
}

function markdownToTiptapHTML(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let listOpen = false
  const closeList = () => {
    if (listOpen) {
      out.push('</ul>')
      listOpen = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '')

    // GitHub-style pipe table.
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeList()
      const headerCells = splitRow(line)
      i += 1 // skip separator
      const headerHtml = headerCells.map((c) => `<th>${inlineMarkdownToHTML(c)}</th>`).join('')
      const bodyHtml: string[] = []
      while (i + 1 < lines.length) {
        const peek = lines[i + 1]
        if (!peek.trim() || !peek.includes('|')) break
        const cells = splitRow(peek)
        while (cells.length < headerCells.length) cells.push('')
        bodyHtml.push(
          `<tr>${cells
            .slice(0, headerCells.length)
            .map((c) => `<td>${inlineMarkdownToHTML(c)}</td>`)
            .join('')}</tr>`,
        )
        i += 1
      }
      out.push(`<table><tbody><tr>${headerHtml}</tr>${bodyHtml.join('')}</tbody></table>`)
      continue
    }

    if (!line.trim()) {
      closeList()
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${inlineMarkdownToHTML(heading[2])}</h${level}>`)
      continue
    }

    const bullet = line.match(/^[\s]*[-*]\s+(.+)$/)
    if (bullet) {
      if (!listOpen) {
        out.push('<ul>')
        listOpen = true
      }
      out.push(`<li>${inlineMarkdownToHTML(bullet[1])}</li>`)
      continue
    }

    if (line.match(/^-{3,}$/)) {
      closeList()
      out.push('<hr />')
      continue
    }

    closeList()
    out.push(`<p>${inlineMarkdownToHTML(line)}</p>`)
  }
  closeList()
  return out.join('')
}

// ProseMirror rejects `{ type: 'text', text: '' }` — build a paragraph that
// holds the cell text, or no content at all when the cell is empty.
function cellParagraph(text: string): TiptapNode {
  return text.length > 0
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }
}

// Older proposals were saved before table parsing existed — their content_json
// has plain paragraphs whose text starts with "|". Rebuild them as table nodes
// on load so the doc renders as a real table without needing regeneration.
function upgradeLegacyTables(doc: TiptapDocument): TiptapDocument {
  const paragraphText = (n: TiptapNode): string | null => {
    if (n.type !== 'paragraph' || !n.content) return null
    return n.content.map((c) => c.text ?? '').join('')
  }
  const looksLikeRow = (s: string | null) => !!s && s.trim().startsWith('|') && s.includes('|', 1)
  const looksLikeSep = (s: string | null) =>
    !!s && /^\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/.test(s.trim())

  const next: TiptapNode[] = []
  const nodes = doc.content
  for (let i = 0; i < nodes.length; i++) {
    const headerText = paragraphText(nodes[i])
    const sepText = i + 1 < nodes.length ? paragraphText(nodes[i + 1]) : null
    if (looksLikeRow(headerText) && looksLikeSep(sepText)) {
      const headerCells = splitRow(headerText as string)
      i += 1 // skip separator paragraph
      const rows: string[][] = []
      while (i + 1 < nodes.length) {
        const rowText = paragraphText(nodes[i + 1])
        if (!looksLikeRow(rowText)) break
        const cells = splitRow(rowText as string)
        while (cells.length < headerCells.length) cells.push('')
        rows.push(cells.slice(0, headerCells.length))
        i += 1
      }
      next.push({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: headerCells.map((c) => ({
              type: 'tableHeader',
              content: [cellParagraph(c)],
            })),
          },
          ...rows.map<TiptapNode>((cells) => ({
            type: 'tableRow',
            content: cells.map((c) => ({
              type: 'tableCell',
              content: [cellParagraph(c)],
            })),
          })),
        ],
      })
      continue
    }
    next.push(nodes[i])
  }
  return sanitizeDoc({ type: 'doc', content: next })
}

// Strip empty text nodes anywhere in the tree — ProseMirror throws on them.
// Stored proposals from earlier versions may already contain `{type:'text',text:''}`.
function sanitizeDoc(doc: TiptapDocument): TiptapDocument {
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
    content: doc.content.map(visit).filter((c): c is TiptapNode => c !== null),
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractSections(editor: Editor): OutlineSection[] {
  const out: OutlineSection[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'heading' && (node.attrs.level === 1 || node.attrs.level === 2)) {
      const text = node.textContent.trim()
      if (text) out.push({ id: slugify(text), label: text })
    }
  })
  return out
}

export function ProposalEditor({
  documentId,
  initialContent,
  initialJson,
  onSectionsChange,
  readOnly = false,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'The document will appear here once generated…',
        emptyEditorClass: 'is-editor-empty',
      }),
      Table.configure({ resizable: !readOnly }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    editable: !readOnly,
    content:
      (initialJson ? upgradeLegacyTables(initialJson) : null) ??
      (initialContent ? markdownToTiptapHTML(initialContent) : ''),
    editorProps: {
      attributes: {
        class: 'doc focus:outline-none min-h-full',
      },
    },
    onCreate: ({ editor }) => {
      onSectionsChange?.(extractSections(editor))
      // Tag h1/h2 nodes with anchor IDs for outline jump-to-scroll.
      tagHeadings(editor)
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON())
      onSectionsChange?.(extractSections(editor))
      tagHeadings(editor)
    },
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce(async (json: unknown) => {
      await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_json: json }),
      })
    }, 1500),
    [documentId],
  )

  useEffect(() => {
    if (!editor) return
    if (initialJson) {
      editor.commands.setContent(upgradeLegacyTables(initialJson) as never)
      onSectionsChange?.(extractSections(editor))
    } else if (initialContent) {
      editor.commands.setContent(markdownToTiptapHTML(initialContent))
      onSectionsChange?.(extractSections(editor))
    }
    tagHeadings(editor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJson, initialContent, editor])

  return <EditorContent editor={editor} className="min-h-full" />
}

// Mirror the slug ids onto the DOM so .scrollIntoView() from the outline works.
function tagHeadings(editor: Editor) {
  const root = editor.view.dom
  const headings = root.querySelectorAll('h1, h2')
  headings.forEach((h) => {
    const id = slugify((h.textContent ?? '').trim())
    if (id) (h as HTMLElement).id = id
  })
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}
