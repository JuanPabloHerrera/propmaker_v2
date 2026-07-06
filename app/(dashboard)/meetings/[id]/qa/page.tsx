'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { QAToolbar } from '@/components/qa/QAToolbar'
import { SingleQuestionView } from '@/components/qa/SingleQuestionView'
import { DetectedProductsCard } from '@/components/qa/DetectedProductsCard'
import { Skeleton } from '@/components/ui/skeleton'
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

  async function streamChat(
    userMessage: string | undefined,
    history: Message[],
    opts?: { generate?: boolean },
  ) {
    setStreaming(true)
    setStreamingText('')

    const next = userMessage
      ? [...history, { role: 'user' as const, content: userMessage }]
      : history
    if (userMessage) setMessages(next)

    let assistantText = ''
    let toBrief = false
    let errorMessage: string | null = null

    try {
      const res = await fetch(`/api/meetings/${id}/proposal/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userMessage ?? null,
          generate: opts?.generate ?? false,
        }),
      })

      if (!res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

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
            if (parsed.toBrief) toBrief = true
            if (parsed.error) errorMessage = parsed.error
          } catch {
            /* malformed SSE */
          }
        }
      }
    } catch {
      errorMessage = 'Connection lost while talking to the agent.'
    } finally {
      setStreamingText('')
      setStreaming(false)
    }

    const clean = assistantText.replace('[READY_TO_GENERATE]', '').trim()
    if (clean) setMessages((prev) => [...prev, { role: 'assistant', content: clean }])

    if (errorMessage) {
      toast.error(errorMessage)
    } else if (toBrief || assistantText.includes('[READY_TO_GENERATE]')) {
      // Q&A done — head to the brief review step, where the prioritized
      // synthesis is generated before the proposal is written.
      router.push(`/meetings/${id}/brief`)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    await streamChat(text, messages)
  }

  async function generateNow() {
    if (generating || streaming) return
    setGenerating(true)
    try {
      // Deterministic: skip the remaining questions and hand off to the brief
      // review step, regardless of how many questions were answered.
      await streamChat(undefined, messages, { generate: true })
    } finally {
      setGenerating(false)
    }
  }

  // Stable callback so DetectedProductsCard's mount-time detection effect
  // doesn't see a new function identity each render (which would loop).
  const handleMeetingChange = React.useCallback((next: Partial<Meeting>) => {
    setMeeting((m) => (m ? ({ ...m, ...next } as Meeting) : m))
  }, [])

  // Count completed assistant messages as the question index.
  const askedCount = messages.filter((m) => m.role === 'assistant').length
  const questionIndex = Math.max(1, Math.min(EXPECTED_QUESTIONS, askedCount))

  if (!meeting) {
    return (
      <div
        className="flex-1 flex flex-col lg-shell"
        role="status"
        aria-live="polite"
      >
        <div
          className="flex items-center gap-3"
          style={{ padding: '14px 24px', borderBottom: '0.5px solid var(--line-1)' }}
        >
          <Skeleton style={{ height: 14, width: 220 }} />
          <div className="flex-1" />
          <Skeleton style={{ height: 24, width: 80, borderRadius: 6 }} />
        </div>
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ padding: '32px 22%', gap: 14 }}
        >
          <Skeleton style={{ height: 22, width: '70%' }} />
          <Skeleton style={{ height: 14, width: '60%' }} />
          <Skeleton style={{ height: 14, width: '50%' }} />
          <Skeleton style={{ height: 42, width: '100%', borderRadius: 10, marginTop: 16 }} />
        </div>
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
        disabled={streaming || generating}
        busy={generating}
      />

      <div style={{ padding: '12px 22% 0' }}>
        <DetectedProductsCard
          meetingId={id}
          initialAttachedIds={meeting.attached_product_ids ?? []}
          initialDetectedIds={meeting.detected_product_ids ?? []}
          onMeetingChange={handleMeetingChange}
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
          {generating ? 'Preparing…' : 'Continue to review →'}
        </button>
      </div>
    </div>
  )
}
