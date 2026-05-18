'use client'

import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  meetingId: string
  initialContent?: string
  initialJson?: unknown
  onSave?: () => void
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

export function ProposalEditor({ meetingId, initialContent, initialJson }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Proposal will appear here once the Q&A is complete…',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: initialJson ?? (initialContent ? markdownToTiptapHTML(initialContent) : ''),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-full px-6 py-5 text-[#1d1d1f]',
      },
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON())
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
    [meetingId]
  )

  useEffect(() => {
    if (!editor) return
    if (initialJson) {
      editor.commands.setContent(initialJson as any)
    } else if (initialContent) {
      editor.commands.setContent(markdownToTiptapHTML(initialContent))
    }
  }, [initialJson, initialContent, editor])

  return (
    <div className="flex-1 overflow-y-auto">
      <style>{`
        .tiptap.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #6e6e73;
          pointer-events: none;
          height: 0;
          font-size: 0.875rem;
        }
        .tiptap h1 { font-size: 1.375rem; font-weight: 600; margin: 1.25rem 0 0.5rem; letter-spacing: -0.01em; color: #1d1d1f; }
        .tiptap h2 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.375rem; color: #1d1d1f; }
        .tiptap h3 { font-size: 0.875rem; font-weight: 600; margin: 0.75rem 0 0.25rem; color: #1d1d1f; }
        .tiptap p { margin: 0.375rem 0; font-size: 0.875rem; line-height: 1.6; color: #1d1d1f; }
        .tiptap ul { padding-left: 1.25rem; margin: 0.375rem 0; }
        .tiptap li { font-size: 0.875rem; line-height: 1.6; color: #1d1d1f; margin: 0.125rem 0; }
        .tiptap strong { font-weight: 600; }
      `}</style>
      <EditorContent editor={editor} className="min-h-full" />
    </div>
  )
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}
