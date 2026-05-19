'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Suggestion } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  meetingId: string
}

export function LiveChatPanel({ meetingId }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load persisted live chat history on mount
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
        }))
      )
    })()
    return () => { cancelled = true }
  }, [meetingId, supabase])

  // Subscribe to suggestions table and add them as proactive assistant messages
  useEffect(() => {
    const channel = supabase
      .channel(`live-chat-suggestions-${meetingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'suggestions', filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          const suggestion = payload.new as Suggestion
          const questions: string[] = Array.isArray(suggestion.questions) ? suggestion.questions : []
          if (questions.length === 0) return
          const content = `Consider asking:\n${questions.map((q) => `• ${q}`).join('\n')}`
          setMessages((prev) => [
            ...prev,
            { id: suggestion.id, role: 'assistant', content },
          ])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [meetingId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
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
      body: JSON.stringify({ userMessage: text, chatHistory: history }),
    })

    if (!res.body) { setStreaming(false); return }

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
        } catch { /* malformed SSE line */ }
      }
    }

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: assistantText }])
    setStreamingText('')
    setStreaming(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage()
  }

  return (
    <div className="w-80 shrink-0 border-l border-[#d2d2d7] flex flex-col overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[#d2d2d7]">
        <span className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">AI Co-pilot</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-xl mb-3">💡</div>
            <p className="text-xs text-[#6e6e73] max-w-[200px]">
              Suggestions will appear as the conversation unfolds. You can also ask anything about the meeting.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#1d1d1f] text-white rounded-br-sm'
                  : 'bg-[#f5f5f7] text-[#1d1d1f] rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed bg-[#f5f5f7] text-[#1d1d1f] whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-1 h-3.5 bg-[#6e6e73] ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[#d2d2d7]">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the meeting…"
            rows={2}
            disabled={streaming}
            className="flex-1 resize-none rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
          <Button
            type="submit"
            disabled={streaming || !input.trim()}
            className="self-end rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white h-9 px-4 text-sm"
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}
