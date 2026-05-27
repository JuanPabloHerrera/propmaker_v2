'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { TiptapDocument } from '@/types'
import { Pill } from '@/components/ui/pill'
import { Icon } from '@/components/ui/icon'

interface Props {
  meetingId: string
  initialJson?: TiptapDocument | null
  remoteJson?: TiptapDocument | null
}

export function NotesPad({ meetingId, initialJson, remoteJson }: Props) {
  const lastSavedRef = useRef<string>('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          'Take notes here. The proposal will draw from these alongside the transcript…',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: initialJson ?? '',
    editorProps: {
      attributes: {
        class: 'doc focus:outline-none min-h-full',
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      lastSavedRef.current = JSON.stringify(json)
      debouncedSave(json)
    },
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce(async (json: unknown) => {
      await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes_json: json }),
      })
    }, 1500),
    [meetingId],
  )

  // Apply remote updates only when the local editor isn't focused, to avoid cursor jumps.
  useEffect(() => {
    if (!editor || !remoteJson) return
    const incoming = JSON.stringify(remoteJson)
    if (incoming === lastSavedRef.current) return
    if (editor.isFocused) return
    editor.commands.setContent(remoteJson as never)
    lastSavedRef.current = incoming
  }, [remoteJson, editor])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-auto" style={{ padding: '28px 44px' }}>
        <style>{`
          .tiptap.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--ink-4);
            pointer-events: none;
            height: 0;
            font-size: 12.5px;
          }
        `}</style>
        <EditorContent editor={editor} className="min-h-full" />
      </div>
      <div
        className="shrink-0 flex items-center gap-2"
        style={{
          margin: '0 24px 18px',
          padding: '8px 10px',
          borderRadius: 10,
          background: 'rgba(255, 253, 247, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '0.5px solid var(--line-1)',
        }}
      >
        <span style={{ color: 'var(--ink-3)' }}>
          <Icon name="pen" />
        </span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
          Notes autosave as you type · <span className="mono-num">⌘ + Click headings</span>
        </span>
        <Pill mono>AI ASSIST</Pill>
      </div>
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
