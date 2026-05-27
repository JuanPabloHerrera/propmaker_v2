'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { QAToolbar } from '@/components/qa/QAToolbar'
import { SingleQuestionView } from '@/components/qa/SingleQuestionView'
import { DetectedProductsCard } from '@/components/qa/DetectedProductsCard'
import { Icon } from '@/components/ui/icon'
import type { Meeting } from '@/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const EXPECTED_QUESTIONS = 5

export default function QAPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [meeting, setMeeting] = React.useState<Meeting | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [streaming, setStreaming] = React.useState(false)
  const [streamingText, setStreamingText] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const startedRef = React.useRef(false)

  // Load meeting + start the first question on mount.
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('meetings').select('*').eq('id', id).single()
      if (cancelled) return
      if (data) setMeeting(data as Meeting)
      if (!startedRef.current) {
        startedRef.current = true
        // Auto-kick the first question — no input means "ask me one"
        await streamChat(undefined, [])
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function streamChat(userMessage: string | undefined, history: Message[]) {
    setStreaming(true)
    setStreamingText('')

    const next = userMessage
      ? [...history, { role: 'user' as const, content: userMessage }]
      : history
    if (userMessage) setMessages(next)

    const res = await fetch(`/api/meetings/${id}/proposal/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: userMessage ?? null }),
    })

    if (!res.body) {
      setStreaming(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''
    let proposal: string | null = null

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
          if (parsed.proposal) proposal = parsed.proposal
        } catch {
          /* malformed SSE */
        }
      }
    }

    const clean = assistantText.replace('[READY_TO_GENERATE]', '').trim()
    setMessages((prev) => [...prev, { role: 'assistant', content: clean }])
    setStreamingText('')
    setStreaming(false)

    if (proposal) {
      // Proposal generated mid-stream — head to proposal page.
      router.push(`/meetings/${id}/proposal`)
    } else if (assistantText.includes('[READY_TO_GENERATE]')) {
      // Agent has signalled it's ready; surface generate button
      toast.success('Ready to generate proposal')
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    await streamChat(text, messages)
  }

  async function generateNow() {
    if (generating) return
    setGenerating(true)
    // Send a sentinel message that asks the agent to wrap up.
    await streamChat(
      'I have answered enough — please generate the proposal now.',
      messages,
    )
    setGenerating(false)
  }

  // Count completed assistant messages as the question index.
  const askedCount = messages.filter((m) => m.role === 'assistant').length
  const questionIndex = Math.max(1, Math.min(EXPECTED_QUESTIONS, askedCount))

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center lg-shell">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Loading…
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen lg-shell">
      <QAToolbar
        meeting={meeting}
        questionIndex={questionIndex}
        totalQuestions={EXPECTED_QUESTIONS}
        onSkip={generateNow}
      />

      <div style={{ padding: '12px 22% 0' }}>
        <DetectedProductsCard
          meetingId={id}
          initialAttachedIds={meeting.attached_product_ids ?? []}
          initialDetectedIds={meeting.detected_product_ids ?? []}
          onMeetingChange={(next) =>
            setMeeting((m) => (m ? ({ ...m, ...next } as Meeting) : m))
          }
        />
      </div>

      <SingleQuestionView
        messages={messages}
        streamingText={streamingText}
        inputValue={input}
        setInputValue={setInput}
        onSend={send}
        onCmdEnter={generateNow}
        streaming={streaming}
      />

      <div
        className="flex items-center justify-between shrink-0"
        style={{ padding: '12px 22% 18px' }}
      >
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 11, color: 'var(--ink-3)' }}
        >
          <Icon name="sparkle" size={13} />
          <span>
            {Math.max(0, EXPECTED_QUESTIONS - askedCount)} more question
            {Math.max(0, EXPECTED_QUESTIONS - askedCount) === 1 ? '' : 's'} after this
          </span>
        </div>
        <button
          type="button"
          onClick={generateNow}
          disabled={streaming || generating}
          className="font-medium"
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'var(--ink-2)',
            background: 'transparent',
          }}
        >
          {generating ? 'Generating…' : 'Generate proposal now →'}
        </button>
      </div>
    </div>
  )
}
