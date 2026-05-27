'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'

interface Props {
  open: boolean
  onClose: () => void
  meetingId: string
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
    "Tell me what to change. I'll suggest revisions and you can hit \"Apply changes\" when ready. Examples:\n• Shorten the Executive Summary\n• Bump the timeline to 8 weeks\n• Drop the Discovery line item\n• Tone: more confident, less hedging",
}

export function RefineDrawer({ open, onClose, meetingId, onApplied }: Props) {
  const [history, setHistory] = React.useState<ChatMsg[]>([SEED_PROMPT])
  const [input, setInput] = React.useState('')
  const [streaming, setStreaming] = React.useState(false)
  const [applying, setApplying] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const previouslyFocused = React.useRef<HTMLElement | null>(null)

  // Reset when drawer closes so each session starts fresh.
  React.useEffect(() => {
    if (!open) {
      setHistory([SEED_PROMPT])
      setInput('')
    }
  }, [open])

  // Focus management: capture caller, focus input on open, restore on close.
  React.useEffect(() => {
    if (open) {
      previouslyFocused.current =
        (document.activeElement as HTMLElement | null) ?? null
      setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      previouslyFocused.current?.focus?.()
    }
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
      if (e.key === 'Escape' && !streaming && !applying) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, streaming, applying, onClose])

  async function runStream(mode: 'chat' | 'apply', baseHistory: ChatMsg[]) {
    const res = await fetch(`/api/meetings/${meetingId}/proposal/refine`, {
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

  async function applyChanges() {
    if (applying || streaming) return
    // Apply uses the same history; the seed prompt is filtered server-side
    // by the assistant ignoring it (it's the kick-off message, not a request).
    setApplying(true)
    try {
      const { applied } = await runStream('apply', history)
      if (applied) {
        toast.success('Proposal updated')
        onApplied()
        onClose()
      } else {
        toast.error('Apply finished but the doc was not updated.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apply failed')
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

  const canApply =
    history.some((m) => m.role === 'user') && !streaming && !applying

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Refine proposal"
      className="fixed inset-0 z-40 pm-no-print"
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close refine drawer"
        onClick={() => {
          if (!streaming && !applying) onClose()
        }}
        className="absolute inset-0 bg-black/20 transition-opacity"
      />

      {/* Drawer */}
      <div
        className="absolute right-0 top-0 bottom-0 flex flex-col glass-strong"
        style={{
          width: 'min(440px, 92vw)',
          borderRadius: 0,
          borderLeft: '0.5px solid var(--line-1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '14px 18px',
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
              Refine proposal
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={streaming || applying}
            aria-label="Close refine drawer"
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
          style={{ padding: '14px 18px' }}
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
          style={{
            padding: '12px 18px 14px',
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
              minHeight: 52,
            }}
          />
          <div className="flex items-center justify-between mt-2.5">
            <button
              type="button"
              onClick={applyChanges}
              disabled={!canApply}
              className="text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 7,
                color: 'white',
                background:
                  'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                border: '0.5px solid rgba(77,138,107,0.6)',
                boxShadow:
                  '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
                cursor: canApply ? 'pointer' : 'not-allowed',
              }}
            >
              {applying ? 'Applying…' : 'Apply changes'}
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
    </div>
  )
}
