'use client'

import * as React from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { Icon, type IconName } from '@/components/ui/icon'

interface Props {
  editor: Editor | null
}

type HeadingLevel = 1 | 2 | 3

/**
 * Formatting bar for the notes pad. Tiptap v3 doesn't re-render React on
 * editor transactions, so active states are read through useEditorState.
 */
export function NotesToolbar({ editor }: Props) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            strike: editor.isActive('strike'),
            h1: editor.isActive('heading', { level: 1 }),
            h2: editor.isActive('heading', { level: 2 }),
            h3: editor.isActive('heading', { level: 3 }),
            bulletList: editor.isActive('bulletList'),
            orderedList: editor.isActive('orderedList'),
            blockquote: editor.isActive('blockquote'),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }
        : null,
  })

  if (!editor || !state) return null

  const heading = (level: HeadingLevel) =>
    editor.chain().focus().toggleHeading({ level }).run()

  return (
    <div
      className="shrink-0 flex items-center gap-0.5 flex-wrap pm-no-print"
      style={{ padding: '6px 12px', borderBottom: '0.5px solid var(--line-1)' }}
    >
      <ToolButton label="Bold" icon="bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolButton label="Italic" icon="italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolButton label="Strikethrough" icon="strike" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <Divider />
      <ToolButton label="Heading 1" text="H1" active={state.h1} onClick={() => heading(1)} />
      <ToolButton label="Heading 2" text="H2" active={state.h2} onClick={() => heading(2)} />
      <ToolButton label="Heading 3" text="H3" active={state.h3} onClick={() => heading(3)} />
      <Divider />
      <ToolButton label="Bullet list" icon="list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolButton label="Numbered list" icon="olist" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolButton label="Quote" icon="quote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <Divider />
      <ToolButton label="Undo" icon="undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} />
      <ToolButton label="Redo" icon="redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} />
    </div>
  )
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 0.5, height: 16, background: 'var(--line-1)', margin: '0 4px' }}
    />
  )
}

interface ToolButtonProps {
  label: string
  icon?: IconName
  text?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolButton({ label, icon, text, active = false, disabled = false, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // preventDefault keeps the editor focused while clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex items-center justify-center transition-colors"
      style={{
        width: 26,
        height: 24,
        borderRadius: 6,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        background: active ? 'rgba(77, 138, 107, 0.14)' : 'transparent',
        color: active ? 'var(--accent-base)' : 'var(--ink-2)',
      }}
    >
      {icon ? (
        <Icon name={icon} size={13} />
      ) : (
        <span className="mono-num" style={{ fontSize: 10, fontWeight: 600 }}>
          {text}
        </span>
      )}
    </button>
  )
}
