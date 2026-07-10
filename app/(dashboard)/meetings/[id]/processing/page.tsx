'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { AuroraOrb } from '@/components/ui/aurora-orb'
import { Checklist, type ChecklistItem } from '@/components/ui/checklist'
import type { Meeting } from '@/types'

const STEPS: { id: string; title: string; ms: number }[] = [
  { id: 'stitch', title: 'Stitching audio segments', ms: 600 },
  { id: 'clean', title: 'Cleaning transcript & speaker labels', ms: 800 },
  { id: 'identify', title: 'Identifying products & scope mentions', ms: 900 },
  { id: 'draft', title: 'Drafting clarifying questions', ms: 1100 },
  { id: 'outline', title: 'Generating proposal outline', ms: 900 },
]

const TOTAL_MS = STEPS.reduce((sum, s) => sum + s.ms, 0)

// How long to wait for the Recall webhook to deliver the finalized transcript
// before we actively pull it ourselves and proceed regardless.
const RECALL_WAIT_TIMEOUT_MS = 150_000 // 2.5 min
const RECALL_POLL_MS = 3_000

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const [completed, setCompleted] = React.useState<Set<string>>(new Set())
  const [activeIdx, setActiveIdx] = React.useState(0)
  const [elapsed, setElapsed] = React.useState(0)
  // True once we're expecting a Recall transcript and it hasn't landed yet.
  const [waitingForRecall, setWaitingForRecall] = React.useState(false)

  // Advance to /qa exactly once. `incomplete` marks that we proceeded without a
  // confirmed transcript so the Q&A screen can warn the user.
  const advancedRef = React.useRef(false)
  const advance = React.useCallback(
    (incomplete = false) => {
      if (advancedRef.current) return
      advancedRef.current = true
      router.push(`/meetings/${id}/qa${incomplete ? '?incomplete=1' : ''}`)
    },
    [id, router],
  )

  // Progress ticker (visual only).
  React.useEffect(() => {
    const ticker = setInterval(() => setElapsed((e) => e + 100), 100)
    return () => clearInterval(ticker)
  }, [])

  // Animated checklist steps (visual only — advancing is gated separately).
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return
        setActiveIdx(i)
        await new Promise((r) => setTimeout(r, STEPS[i].ms))
        if (cancelled) return
        setCompleted((prev) => new Set(prev).add(STEPS[i].id))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Readiness gate: decide when it's safe to advance to Q&A.
  React.useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    const teardown = () => {
      if (pollTimer) clearInterval(pollTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (channel) supabase.removeChannel(channel)
    }

    const checkReady = async (): Promise<boolean> => {
      const { data: row } = await supabase
        .from('meetings')
        .select('recall_transcript_ready')
        .eq('id', id)
        .single()
      return !!(row as { recall_transcript_ready?: boolean } | null)?.recall_transcript_ready
    }

    ;(async () => {
      const { data } = await supabase
        .from('meetings')
        .select('capture_mode, recall_bot_id, recall_transcript_ready')
        .eq('id', id)
        .single()
      if (cancelled) return

      const m = data as Pick<
        Meeting,
        'capture_mode' | 'recall_bot_id' | 'recall_transcript_ready'
      > | null

      const expectsRecall =
        !!m &&
        !!m.recall_bot_id &&
        (m.capture_mode === 'recall' || m.capture_mode === 'both')

      // Browser-only capture: nothing to wait for — segments are already
      // persisted from the live call. Advance once the animation finishes.
      if (!expectsRecall) {
        const remaining = Math.max(0, TOTAL_MS - elapsed) + 400
        timeoutTimer = setTimeout(() => advance(false), remaining)
        return
      }

      // Already have the finalized transcript.
      if (m?.recall_transcript_ready) {
        advance(false)
        return
      }

      // Wait for the Recall webhook. Show honest "waiting" copy on the last step.
      setWaitingForRecall(true)

      // Realtime: advance the moment the flag flips.
      channel = supabase
        .channel(`processing-ready-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'meetings',
            filter: `id=eq.${id}`,
          },
          (payload) => {
            const next = payload.new as { recall_transcript_ready?: boolean }
            if (next.recall_transcript_ready) {
              teardown()
              advance(false)
            }
          },
        )
        .subscribe()

      // Poll fallback in case realtime doesn't deliver.
      pollTimer = setInterval(async () => {
        if (cancelled) return
        if (await checkReady()) {
          teardown()
          advance(false)
        }
      }, RECALL_POLL_MS)

      // Timeout: actively pull the transcript via the sync endpoint, then proceed
      // regardless (with a warning if it's still empty).
      timeoutTimer = setTimeout(async () => {
        teardown()
        if (cancelled) return
        try {
          const res = await fetch(`/api/meetings/${id}/sync`, { method: 'POST' })
          const json = await res.json().catch(() => ({}))
          if (!cancelled && (json?.synced > 0 || (await checkReady()))) {
            advance(false)
            return
          }
        } catch {
          /* fall through to incomplete proceed */
        }
        if (!cancelled) advance(true)
      }, RECALL_WAIT_TIMEOUT_MS)
    })()

    return () => {
      cancelled = true
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, advance, supabase])

  const progress = Math.min(100, Math.round((Math.min(elapsed, TOTAL_MS) / TOTAL_MS) * 100))
  const remainingMs = Math.max(0, TOTAL_MS - elapsed)
  const remainingSec = Math.ceil(remainingMs / 1000)

  const items: ChecklistItem[] = STEPS.map((s, i) => {
    const isLast = i === STEPS.length - 1
    // While we're still waiting on the Recall transcript, hold the last step
    // "active" with honest copy instead of letting it complete.
    const holdingForRecall = isLast && waitingForRecall
    const title = holdingForRecall ? 'Waiting for the meeting transcript' : s.title
    const state: ChecklistItem['state'] = holdingForRecall
      ? 'active'
      : completed.has(s.id)
        ? 'done'
        : i === activeIdx
          ? 'active'
          : 'pending'
    return {
      id: s.id,
      title,
      state,
      trailing:
        state === 'active' ? (
          <span
            className="mono-num"
            style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--accent-base)' }}
          >
            WORKING…
          </span>
        ) : undefined,
    }
  })

  return (
    <div className="min-h-screen lg-shell flex items-center justify-center">
      <div
        className="flex flex-col items-center"
        style={{ width: 520, padding: '32px 24px' }}
      >
        <div className="mb-7">
          <AuroraOrb size={120} />
        </div>

        <div className="pm-eyebrow">Processing meeting</div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '4px 0 6px',
            textAlign: 'center',
            color: 'var(--ink-1)',
          }}
        >
          {waitingForRecall
            ? 'Waiting for the full meeting transcript'
            : 'Sending the transcript to your agent'}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: 'var(--ink-2)',
            textAlign: 'center',
            marginBottom: 22,
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          {waitingForRecall
            ? 'Your meeting bot is finalizing the recording. We wait for the complete transcript so your proposal has the full context.'
            : "This usually takes 30–60 seconds. We'll redirect you when the draft questions are ready."}
        </p>

        <div className="card w-full p-4">
          <Checklist items={items} />
        </div>

        <div className="progress mt-4 w-full">
          <i style={{ width: `${waitingForRecall ? 100 : progress}%` }} />
        </div>
        <div
          className="flex justify-between w-full mt-1.5"
          style={{ fontSize: 11, color: 'var(--ink-3)' }}
        >
          <span>
            {completed.size} of {STEPS.length} steps
          </span>
          <span className="mono-num">
            {waitingForRecall
              ? 'finalizing transcript…'
              : remainingSec > 0
                ? `~ ${remainingSec}s remaining`
                : 'almost there'}
          </span>
        </div>
      </div>
    </div>
  )
}
