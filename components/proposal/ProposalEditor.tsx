'use client'

import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { TiptapDocument } from '@/types'
import type { OutlineSection } from './OutlineSidebar'

interface Props {
  meetingId: string
  initialContent?: string
  initialJson?: TiptapDocument | null
  onSectionsChange?: (sections: OutlineSection[]) => void
  readOnly?: boolean
}

function markdownToTiptapHTML(markdown: string): string {
  return markdown
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|l])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
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
  meetingId,
  initialContent,
  initialJson,
  onSectionsChange,
  readOnly = false,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Proposal will appear here once the Q&A is complete…',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    editable: !readOnly,
    content: initialJson ?? (initialContent ? markdownToTiptapHTML(initialContent) : ''),
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
      await fetch(`/api/meetings/${meetingId}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_json: json }),
      })
    }, 1500),
    [meetingId],
  )

  useEffect(() => {
    if (!editor) return
    if (initialJson) {
      editor.commands.setContent(initialJson as never)
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
