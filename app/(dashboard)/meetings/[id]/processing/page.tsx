'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AuroraOrb } from '@/components/ui/aurora-orb'
import { Checklist, type ChecklistItem } from '@/components/ui/checklist'

const STEPS: { id: string; title: string; ms: number }[] = [
  { id: 'stitch', title: 'Stitching audio segments', ms: 600 },
  { id: 'clean', title: 'Cleaning transcript & speaker labels', ms: 800 },
  { id: 'identify', title: 'Identifying products & scope mentions', ms: 900 },
  { id: 'draft', title: 'Drafting clarifying questions', ms: 1100 },
  { id: 'outline', title: 'Generating proposal outline', ms: 900 },
]

const TOTAL_MS = STEPS.reduce((sum, s) => sum + s.ms, 0)

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [completed, setCompleted] = React.useState<Set<string>>(new Set())
  const [activeIdx, setActiveIdx] = React.useState(0)
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    let accumulated = 0
    const ticker = setInterval(() => {
      setElapsed((e) => e + 100)
    }, 100)

    ;(async () => {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return
        setActiveIdx(i)
        await new Promise((r) => setTimeout(r, STEPS[i].ms))
        accumulated += STEPS[i].ms
        if (cancelled) return
        setCompleted((prev) => {
          const next = new Set(prev)
          next.add(STEPS[i].id)
          return next
        })
      }
      if (cancelled) return
      // Brief pause so the user sees the "all done" state, then advance.
      await new Promise((r) => setTimeout(r, 400))
      if (!cancelled) router.push(`/meetings/${id}/qa`)
    })()

    return () => {
      cancelled = true
      clearInterval(ticker)
    }
  }, [id, router])

  const progress = Math.min(100, Math.round((Math.min(elapsed, TOTAL_MS) / TOTAL_MS) * 100))
  const remainingMs = Math.max(0, TOTAL_MS - elapsed)
  const remainingSec = Math.ceil(remainingMs / 1000)

  const items: ChecklistItem[] = STEPS.map((s, i) => ({
    id: s.id,
    title: s.title,
    state: completed.has(s.id) ? 'done' : i === activeIdx ? 'active' : 'pending',
    trailing:
      !completed.has(s.id) && i === activeIdx ? (
        <span
          className="mono-num"
          style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--accent-base)' }}
        >
          WORKING…
        </span>
      ) : undefined,
  }))

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
          Sending the transcript to your agent
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
          This usually takes 30–60 seconds. We&apos;ll redirect you when the draft questions are ready.
        </p>

        <div className="card w-full p-4">
          <Checklist items={items} />
        </div>

        <div className="progress mt-4 w-full">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div
          className="flex justify-between w-full mt-1.5"
          style={{ fontSize: 11, color: 'var(--ink-3)' }}
        >
          <span>
            {completed.size} of {STEPS.length} steps
          </span>
          <span className="mono-num">
            {remainingSec > 0 ? `~ ${remainingSec}s remaining` : 'almost there'}
          </span>
        </div>
      </div>
    </div>
  )
}
