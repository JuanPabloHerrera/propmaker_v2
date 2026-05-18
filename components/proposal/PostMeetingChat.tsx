'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  meetingId: string
  onProposalGenerated: (markdown: string) => void
}

export function PostMeetingChat({ meetingId, onProposalGenerated }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function sendMessage(userMessage?: string) {
    if (streaming) return

    setStreaming(true)
    setStreamingText('')

    const newMessages = userMessage
      ? [...messages, { role: 'user' as const, content: userMessage }]
      : messages

    if (userMessage) {
      setMessages(newMessages)
      setInput('')
    }

    const res = await fetch(`/api/meetings/${meetingId}/proposal/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: userMessage ?? null }),
    })

    if (!res.body) { setStreaming(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') break

        try {
          const parsed = JSON.parse(data)
          if (parsed.text) {
            assistantText += parsed.text
            setStreamingText(assistantText)
          }
          if (parsed.proposal) {
            onProposalGenerated(parsed.proposal)
          }
        } catch { /* malformed SSE line */ }
      }
    }

    const cleanText = assistantText.replace('[READY_TO_GENERATE]', '').trim()
    setMessages((prev) => [...prev, { role: 'assistant', content: cleanText }])
    setStreamingText('')
    setStreaming(false)
  }

  function handleStart() {
    setStarted(true)
    sendMessage()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input.trim())
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!started ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-xl mb-3">📝</div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">Proposal Q&A</h3>
            <p className="text-xs text-[#6e6e73] mt-1 max-w-xs">
              Claude will ask a few questions to fill in any gaps before writing your proposal.
            </p>
            <Button
              onClick={handleStart}
              className="mt-5 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white h-9 px-4 text-sm font-medium"
            >
              Start Q&A
            </Button>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
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
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed bg-[#f5f5f7] text-[#1d1d1f]">
                  {streamingText.replace('[READY_TO_GENERATE]', '')}
                  <span className="inline-block w-1 h-3.5 bg-[#6e6e73] ml-0.5 animate-pulse" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {started && (
        <form onSubmit={handleSubmit} className="p-4 border-t border-[#d2d2d7]">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Your answer…"
              rows={2}
              disabled={streaming}
              className="flex-1 resize-none rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
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
      )}
    </div>
  )
}
