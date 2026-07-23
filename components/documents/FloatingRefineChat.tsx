'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'

interface Props {
  documentId: string
  onApplied: () => void
}

type ChatRole = 'user' | 'assistant'
interface ChatMsg {
  role: ChatRole
  content: string
}

const SEED_PROMPT: ChatMsg = {
  role: 'assistant',
  content:
    "Tell me what to change and I'll help you shape it. When you're happy with the direction, hit \"Rewrite\" and I'll rewrite the document with your feedback. Examples:\n• Shorten the Executive Summary\n• Bump the timeline to 8 weeks\n• Drop the Discovery line item\n• Tone: more confident, less hedging",
}

const MIN_W = 320
const MIN_H = 380

/**
 * Floating AI refine chat — a bottom-right launcher that opens a resizable
 * floating window over the editor. Chat mode discusses changes; the Rewrite
 * button applies the accumulated feedback via /api/documents/[id]/refine
 * (mode 'apply') and refetches the document. Chat history persists across
 * open/close within the page session so feedback can accumulate.
 */
export function FloatingRefineChat({ documentId, onApplied }: Props) {
  const [open, setOpen] = React.useState(false)
  const [size, setSize] = React.useState({ w: 380, h: 520 })
  const [history, setHistory] = React.useState<ChatMsg[]>([SEED_PROMPT])
  const [input, setInput] = React.useState('')
  const [streaming, setStreaming] = React.useState(false)
  const [applying, setApplying] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const resizeStart = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  // Auto-scroll on new messages / streaming chunks.
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, streaming])

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !streaming && !applying) setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, streaming, applying])

  // Top-left corner resize: the panel is anchored bottom-right, so dragging the
  // handle up/left grows it (CSS `resize` only offers a bottom-right handle,
  // which would push the panel off-screen here).
  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault()
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    const move = (ev: PointerEvent) => {
      const s = resizeStart.current
      if (!s) return
      const maxW = Math.min(window.innerWidth * 0.92, 640)
      const maxH = Math.min(window.innerHeight * 0.85, 760)
      setSize({
        w: Math.max(MIN_W, Math.min(maxW, s.w + (s.x - ev.clientX))),
        h: Math.max(MIN_H, Math.min(maxH, s.h + (s.y - ev.clientY))),
      })
    }
    const up = () => {
      resizeStart.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  async function runStream(mode: 'chat' | 'apply', baseHistory: ChatMsg[]) {
    const res = await fetch(`/api/documents/${documentId}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, history: baseHistory }),
    })
    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => '')
      throw new Error(err || 'Refine request failed')
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''
    let applied = false
    let buffer = ''

    // Seed an empty assistant message; we'll append text into it.
    setHistory((h) => [...h, { role: 'assistant', content: '' }])

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') continue
        try {
          const obj = JSON.parse(payload) as {
            text?: string
            applied?: boolean
            error?: string
          }
          if (obj.error) throw new Error(obj.error)
          if (obj.text) {
            assistantText += obj.text
            setHistory((h) => {
              const next = h.slice()
              next[next.length - 1] = { role: 'assistant', content: assistantText }
              return next
            })
          }
          if (obj.applied) applied = true
        } catch {
          // ignore malformed events
        }
      }
    }
    return { assistantText, applied }
  }

  async function sendChat() {
    const text = input.trim()
    if (!text || streaming || applying) return
    setInput('')
    const next: ChatMsg[] = [...history, { role: 'user', content: text }]
    setHistory(next)
    setStreaming(true)
    try {
      await runStream('chat', next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refine chat failed')
      // Remove the empty assistant bubble if streaming aborted.
      setHistory((h) =>
        h[h.length - 1]?.role === 'assistant' && h[h.length - 1]?.content === ''
          ? h.slice(0, -1)
          : h,
      )
    } finally {
      setStreaming(false)
    }
  }

  async function rewrite() {
    if (applying || streaming) return
    setApplying(true)
    try {
      // The rewrite pass replaces the streamed text with the full document, so
      // don't render it as a chat bubble — drop it and confirm instead.
      const before = history
      const { applied } = await runStream('apply', history)
      if (applied) {
        toast.success('Document rewritten with your feedback.')
        onApplied()
        setHistory([
          ...before,
          { role: 'assistant', content: 'Done — I rewrote the document with your feedback. Keep the notes coming if you want another pass.' },
        ])
      } else {
        setHistory(before)
        toast.error('Rewrite finished but the document was not updated — try again.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rewrite failed — try again.')
    } finally {
      setApplying(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChat()
    }
  }

  const canRewrite = history.some((m) => m.role === 'user') && !streaming && !applying

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI refine chat"
        className="fixed z-40 grid place-items-center pm-no-print text-white"
        style={{
          right: 24,
          bottom: 24,
          width: 52,
          height: 52,
          borderRadius: 999,
          background:
            'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
          border: '0.5px solid rgba(77,138,107,0.6)',
          boxShadow:
            '0 6px 18px var(--accent-glow), 0 2px 6px rgba(28,22,14,0.18), inset 0 1px 0 rgba(255,255,255,0.35)',
          cursor: 'pointer',
        }}
      >
        <Icon name="sparkle" size={20} />
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label="AI refine chat"
      className="fixed z-40 flex flex-col glass-strong pm-no-print"
      style={{
        right: 20,
        bottom: 20,
        width: size.w,
        height: size.h,
        borderRadius: 16,
        border: '0.5px solid var(--line-1)',
        boxShadow: '0 18px 48px rgba(28,22,14,0.22), 0 4px 12px rgba(28,22,14,0.10)',
        overflow: 'hidden',
      }}
    >
      {/* Resize handle — top-left corner */}
      <div
        onPointerDown={onResizeStart}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 5,
            left: 5,
            width: 8,
            height: 8,
            borderTop: '2px solid var(--ink-3)',
            borderLeft: '2px solid var(--ink-3)',
            borderTopLeftRadius: 3,
            opacity: 0.55,
          }}
        />
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: '12px 16px 12px 24px',
          borderBottom: '0.5px solid var(--line-1)',
          background: 'rgba(255, 252, 245, 0.55)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--accent-base)' }}>
            <Icon name="sparkle" size={14} />
          </span>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
            Refine with AI
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={streaming || applying}
          aria-label="Close refine chat"
          className="grid place-items-center rounded-md hover:bg-[rgba(28,24,20,0.04)] disabled:opacity-50"
          style={{ width: 28, height: 28, color: 'var(--ink-2)' }}
        >
          <Icon name="close" size={12} strokeWidth={1.6} />
        </button>
      </div>

      {/* Chat scroll */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto"
        style={{ padding: '14px 16px' }}
      >
        <ul className="flex flex-col gap-2.5" role="log" aria-live="polite">
          {history.map((m, i) => (
            <li
              key={i}
              className={`max-w-[88%] rounded-2xl ${m.role === 'user' ? 'self-end' : 'self-start'}`}
              style={{
                padding: '8px 12px',
                fontSize: 12.5,
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                background:
                  m.role === 'user'
                    ? 'var(--accent-soft)'
                    : 'rgba(255, 253, 247, 0.85)',
                border:
                  m.role === 'user'
                    ? '0.5px solid rgba(77,138,107,0.25)'
                    : '0.5px solid var(--line-1)',
                color: 'var(--ink-1)',
              }}
            >
              {m.content || (
                <span
                  aria-label="Assistant is typing"
                  className="inline-block"
                  style={{ color: 'var(--ink-3)' }}
                >
                  …
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Composer */}
      <div
        className="shrink-0"
        style={{
          padding: '10px 16px 12px',
          borderTop: '0.5px solid var(--line-1)',
          background: 'rgba(255, 252, 245, 0.55)',
        }}
      >
        <label htmlFor="refine-input" className="sr-only">
          Refine request
        </label>
        <textarea
          id="refine-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={streaming || applying}
          placeholder="What should change? (Enter to send · Shift+Enter for newline)"
          rows={2}
          className="field w-full"
          style={{
            padding: '8px 11px',
            fontSize: 12.5,
            resize: 'none',
            minHeight: 48,
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={rewrite}
            disabled={!canRewrite}
            className="text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 8,
              color: 'white',
              background:
                'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
              border: '0.5px solid rgba(77,138,107,0.6)',
              boxShadow:
                '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
              cursor: canRewrite ? 'pointer' : 'not-allowed',
            }}
          >
            <Icon name="pen" size={11} />
            {applying ? 'Rewriting…' : 'Rewrite'}
          </button>
          <button
            type="button"
            onClick={sendChat}
            disabled={streaming || applying || !input.trim()}
            className="text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 7,
              color: 'var(--ink-1)',
              background: 'rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(28,24,20,0.10)',
              boxShadow:
                '0 1px 2px rgba(28,22,14,0.06), inset 0 0.5px 0 rgba(255,255,255,0.7)',
              cursor: 'pointer',
            }}
          >
            {streaming ? 'Thinking…' : 'Send'}
            {!streaming && <Icon name="send" size={11} />}
          </button>
        </div>
      </div>
    </div>
  )
}
