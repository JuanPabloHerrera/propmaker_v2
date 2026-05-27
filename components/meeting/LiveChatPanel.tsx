'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { Icon } from '@/components/ui/icon'
import type { Suggestion } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  meetingId: string
}

const QUICK_REPLIES = [
  'What did they say about budget?',
  'Summarize the last 5 min',
  'Open questions to ask next',
]

export function LiveChatPanel({ meetingId }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('live_meeting_chat')
        .select('id, role, content')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true })
      if (cancelled || !data) return
      setMessages(
        data.map((m) => ({
          id: m.id as string,
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [meetingId, supabase])

  useEffect(() => {
    const channel = supabase
      .channel(`live-chat-suggestions-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suggestions',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          const suggestion = payload.new as Suggestion
          const questions: string[] = Array.isArray(suggestion.questions)
            ? suggestion.questions
            : []
          if (questions.length === 0) return
          const content = `Consider asking:\n${questions.map((q) => `• ${q}`).join('\n')}`
          setMessages((prev) => [
            ...prev,
            { id: suggestion.id, role: 'assistant', content },
          ])
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [meetingId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function sendMessage(text?: string) {
    const value = (text ?? input).trim()
    if (!value || streaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: value }
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingText('')

    const res = await fetch(`/api/meetings/${meetingId}/live-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: value, chatHistory: history }),
    })
    if (!res.body) {
      setStreaming(false)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          if (parsed.text) {
            assistantText += parsed.text
            setStreamingText(assistantText)
          }
        } catch {
          /* malformed SSE line */
        }
      }
    }
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: assistantText },
    ])
    setStreamingText('')
    setStreaming(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage()
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-2 shrink-0"
        style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--line-1)' }}
      >
        <AvatarInitials initials="P" color="bot" size={22} />
        <div className="flex flex-col">
          <div className="text-[12px] font-semibold" style={{ color: 'var(--ink-1)' }}>
            Co-pilot
          </div>
          <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
            Listening &amp; suggesting
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-3" style={{ padding: 14 }}>
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              Suggestions will appear as the conversation unfolds.
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>
              Or ask anything below.
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
              <div className="bubble-user whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="bubble-ai whitespace-pre-wrap">
              {m.content}
            </div>
          ),
        )}
        {streamingText && (
          <div className="bubble-ai whitespace-pre-wrap">
            {streamingText}
            <span
              className="inline-block w-0.5 h-3.5 ml-0.5 animate-pulse"
              style={{ background: 'var(--ink-3)' }}
            />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0"
        style={{ padding: 12, borderTop: '0.5px solid var(--line-1)' }}
      >
        <div
          className="glass-soft flex items-end gap-1.5"
          style={{ borderRadius: 12, padding: '8px 8px 8px 12px' }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this meeting…"
            rows={1}
            disabled={streaming}
            className="flex-1 bg-transparent outline-none resize-none"
            style={{ fontSize: 12, color: 'var(--ink-1)', padding: '6px 0' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="inline-flex items-center justify-center text-white"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background:
                'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
              border: '0.5px solid rgba(77,138,107,0.6)',
            }}
            aria-label="Send"
          >
            <Icon name="send" size={12} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              disabled={streaming}
              className="pill cursor-pointer hover:bg-white/80 transition-colors"
              style={{ fontSize: 10.5 }}
            >
              {q}
            </button>
          ))}
        </div>
      </form>
    </div>
  )
}
