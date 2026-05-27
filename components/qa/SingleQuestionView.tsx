'use client'

import * as React from 'react'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { Icon } from '@/components/ui/icon'
import { QuickReplyChips } from './QuickReplyChips'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  messages: Message[]
  streamingText: string
  inputValue: string
  setInputValue: (v: string) => void
  onSend: () => void
  onCmdEnter: () => void
  streaming: boolean
  quickReplies?: string[]
}

export function SingleQuestionView({
  messages,
  streamingText,
  inputValue,
  setInputValue,
  onSend,
  onCmdEnter,
  streaming,
  quickReplies = [],
}: Props) {
  // Only show an "active" question when the latest message is an unanswered
  // assistant turn. Once the user answers, the question moves into priorPairs
  // below and should not also be rendered as the active card.
  const lastMessage = messages[messages.length - 1]
  const pendingQuestion =
    lastMessage?.role === 'assistant' ? lastMessage.content : ''
  const activeText = streamingText || pendingQuestion

  // Show prior Q/A as a compact stack above the active question.
  const priorPairs: { q: string; a: string }[] = []
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'assistant' && messages[i + 1]?.role === 'user') {
      priorPairs.push({ q: messages[i].content, a: messages[i + 1].content })
      i++
    }
  }

  const inputRef = React.useRef<HTMLInputElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const wasStreamingRef = React.useRef(streaming)

  // Auto-scroll to the latest message as new content (streamed tokens, new
  // user/assistant pairs, quick-reply pre-fills) lands.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, streamingText, priorPairs.length])

  // Refocus the input after the agent finishes streaming so the user can
  // immediately type the next answer.
  React.useEffect(() => {
    if (wasStreamingRef.current && !streaming) {
      inputRef.current?.focus()
    }
    wasStreamingRef.current = streaming
  }, [streaming])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.metaKey || e.ctrlKey) onCmdEnter()
      else onSend()
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '24px 22% 0' }}>
      <div className="flex flex-col gap-3">
        {/* Prior pairs (compact) */}
        {priorPairs.map((p, i) => (
          <React.Fragment key={i}>
            <div className="flex gap-2.5 items-start opacity-80">
              <AvatarInitials initials="P" color="bot" size={26} />
              <div className="bubble-ai whitespace-pre-wrap" style={{ maxWidth: '85%' }}>
                {p.q}
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bubble-user whitespace-pre-wrap" style={{ maxWidth: '85%' }}>
                {p.a}
              </div>
            </div>
          </React.Fragment>
        ))}

        {/* Active question */}
        {activeText && (
          <div className="flex gap-2.5 items-start">
            <AvatarInitials initials="P" color="bot" size={26} ring />
            <div className="flex-1" style={{ maxWidth: '85%' }}>
              <div
                className="bubble-ai whitespace-pre-wrap"
                style={{
                  background: 'rgba(255, 253, 247, 0.85)',
                  boxShadow: '0 4px 18px var(--accent-glow)',
                  borderColor: 'rgba(77, 138, 107, 0.25)',
                }}
              >
                {activeText.replace('[READY_TO_GENERATE]', '').trim()}
                {streaming && (
                  <span
                    className="inline-block w-0.5 h-3.5 ml-0.5 animate-pulse"
                    style={{ background: 'var(--ink-3)' }}
                  />
                )}
                {quickReplies.length > 0 && (
                  <div className="mt-2.5">
                    <QuickReplyChips
                      replies={quickReplies}
                      onPick={(v) => setInputValue(v)}
                    />
                  </div>
                )}
              </div>

              {/* Compose */}
              <div
                className="glass-soft mt-3 flex items-center gap-2"
                style={{ borderRadius: 12, padding: '6px 6px 6px 12px' }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Your answer…"
                  disabled={streaming}
                  autoFocus
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 12.5, color: 'var(--ink-1)', height: 32 }}
                />
                <button
                  type="button"
                  onClick={onSend}
                  disabled={streaming || !inputValue.trim()}
                  className="inline-flex items-center justify-center text-white"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background:
                      'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                    border: '0.5px solid rgba(77,138,107,0.6)',
                    opacity: streaming || !inputValue.trim() ? 0.5 : 1,
                  }}
                  aria-label="Send"
                >
                  <Icon name="send" size={12} />
                </button>
              </div>
              <div
                className="pl-1 mt-1.5"
                style={{ fontSize: 11, color: 'var(--ink-3)' }}
              >
                ↵ to send · ⌘↵ to send &amp; generate draft
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
