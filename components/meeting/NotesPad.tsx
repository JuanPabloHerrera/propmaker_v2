'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { TiptapDocument } from '@/types'
import { sanitizeDoc } from '@/lib/tiptap'
import { Icon } from '@/components/ui/icon'
import { NotesToolbar } from './NotesToolbar'

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface Props {
  meetingId: string
  initialJson?: TiptapDocument | null
  remoteJson?: TiptapDocument | null
  /** 'live' = full meeting center pane; 'card' = compact embed (documents hub). */
  variant?: 'live' | 'card'
  /** Called after a successful save (the hub uses it to refresh its meeting row). */
  onSaved?: (json: TiptapDocument) => void
}

const SAVE_DEBOUNCE_MS = 1200

export function NotesPad({ meetingId, initialJson, remoteJson, variant = 'live', onSaved }: Props) {
  // JSON string of the content most recently persisted (or received remotely) —
  // used to recognize our own echoes and skip redundant saves.
  const lastSavedRef = useRef<string>(initialJson ? JSON.stringify(initialJson) : '')
  // Latest content not yet persisted; null when clean.
  const pendingRef = useRef<TiptapDocument | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const save = useCallback(
    async (json: TiptapDocument) => {
      setSaveState('saving')
      try {
        const res = await fetch(`/api/meetings/${meetingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes_json: json }),
        })
        if (!res.ok) throw new Error(`Save failed (${res.status})`)
        lastSavedRef.current = JSON.stringify(json)
        // Only mark clean if nothing newer was typed while the request ran.
        if (pendingRef.current === json) {
          pendingRef.current = null
          setSaveState('saved')
        }
        onSaved?.(json)
      } catch {
        setSaveState('error')
      }
    },
    [meetingId, onSaved],
  )

  const scheduleSave = useCallback(
    (json: TiptapDocument) => {
      pendingRef.current = json
      setSaveState('dirty')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (pendingRef.current) void save(pendingRef.current)
      }, SAVE_DEBOUNCE_MS)
    },
    [save],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          'Take notes here. The proposal will draw from these alongside the transcript…',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: initialJson ? sanitizeDoc(initialJson) : '',
    editorProps: {
      attributes: {
        class: 'doc focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(editor.getJSON() as TiptapDocument)
    },
  })

  // Apply remote updates only when there's nothing unsaved locally and the
  // editor isn't focused, to avoid clobbering in-progress typing.
  useEffect(() => {
    if (!editor || !remoteJson) return
    const incoming = JSON.stringify(remoteJson)
    if (incoming === lastSavedRef.current) return
    if (editor.isFocused || pendingRef.current) return
    editor.commands.setContent(sanitizeDoc(remoteJson) as never)
    lastSavedRef.current = incoming
  }, [remoteJson, editor])

  // Flush any pending save when the component unmounts (End meeting navigates
  // away inside the debounce window) or the page is being closed. keepalive
  // lets the request outlive the page.
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const json = pendingRef.current
      if (!json) return
      pendingRef.current = null
      void fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes_json: json }),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [meetingId])

  const isCard = variant === 'card'

  return (
    <div className="flex flex-col h-full min-h-0">
      <NotesToolbar editor={editor} />
      <div
        className="flex-1 min-h-0 overflow-auto flex flex-col"
        style={{ padding: isCard ? '14px 16px' : '24px 44px', cursor: 'text' }}
        onMouseDown={(e) => {
          // Clicks on the padding gutter around the editor still focus it.
          if (e.target === e.currentTarget && editor) {
            e.preventDefault()
            editor.chain().focus('end').run()
          }
        }}
      >
        <style>{`
          .notes-pad-content { flex: 1 1 auto; display: flex; flex-direction: column; }
          .notes-pad-content .tiptap { flex: 1 1 auto; }
          .tiptap.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--ink-4);
            pointer-events: none;
            height: 0;
            font-size: 12.5px;
          }
        `}</style>
        <EditorContent editor={editor} className="notes-pad-content" />
      </div>
      <div
        className="shrink-0 flex items-center gap-2 pm-no-print"
        style={
          isCard
            ? { padding: '6px 12px', borderTop: '0.5px solid var(--line-1)' }
            : {
                margin: '0 24px 18px',
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(255, 253, 247, 0.7)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '0.5px solid var(--line-1)',
              }
        }
      >
        <span style={{ color: 'var(--ink-3)' }}>
          <Icon name="pen" size={isCard ? 11 : 14} />
        </span>
        <span style={{ flex: 1, fontSize: isCard ? 11 : 12, color: 'var(--ink-3)' }}>
          {isCard ? 'Used as context when generating documents' : 'Notes autosave as you type'}
        </span>
        <SaveStatus
          state={saveState}
          onRetry={() => {
            if (pendingRef.current) void save(pendingRef.current)
          }}
        />
      </div>
    </div>
  )
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'idle') return null
  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="mono-num"
        style={{
          fontSize: 10.5,
          color: '#b3502e',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        SAVE FAILED — RETRY
      </button>
    )
  }
  const label = state === 'saved' ? 'SAVED' : 'SAVING…'
  return (
    <span className="mono-num" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
      {label}
    </span>
  )
}
