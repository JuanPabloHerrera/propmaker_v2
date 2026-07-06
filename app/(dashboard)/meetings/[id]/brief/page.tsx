'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { AuroraOrb } from '@/components/ui/aurora-orb'
import { Checklist, type ChecklistItem } from '@/components/ui/checklist'
import { BriefReview } from '@/components/brief/BriefReview'
import { BriefToolbar } from '@/components/brief/BriefToolbar'
import { Icon } from '@/components/ui/icon'
import type { ProposalBrief } from '@/types'

const LOADER_STEPS = [
  'Gathering transcript, notes & answers',
  'Weighing priorities & scope',
  'Matching your product catalog',
  'Drafting your prioritized brief',
]

type Phase = 'loading' | 'generating' | 'ready' | 'error'

export default function BriefPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [brief, setBrief] = React.useState<ProposalBrief | null>(null)
  const [phase, setPhase] = React.useState<Phase>('loading')
  const [error, setError] = React.useState<string | null>(null)
  const [meetingTitle, setMeetingTitle] = React.useState('')
  const [clientCompany, setClientCompany] = React.useState<string | null>(null)
  const [generating, setGenerating] = React.useState(false) // final proposal generation
  const [regenerating, setRegenerating] = React.useState(false)
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle')
  const [step, setStep] = React.useState(0)

  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = React.useRef(false)

  // Load an existing brief; synthesize one on first arrival from Q&A.
  React.useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void supabase
      .from('meetings')
      .select('title, client_company')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setMeetingTitle(data.title ?? '')
          setClientCompany(data.client_company ?? null)
        }
      })

    ;(async () => {
      try {
        const res = await fetch(`/api/meetings/${id}/brief`)
        const data = await res.json()
        if (res.ok && data.brief) {
          setBrief(data.brief)
          setPhase('ready')
          return
        }
      } catch {
        /* fall through to generation */
      }
      await generateInitial()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Purely-visual step ticker while the brief synthesizes.
  React.useEffect(() => {
    if (phase !== 'generating') {
      setStep(0)
      return
    }
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADER_STEPS.length - 1)), 1600)
    return () => clearInterval(t)
  }, [phase])

  React.useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  async function generateInitial() {
    setPhase('generating')
    setError(null)
    try {
      const res = await fetch(`/api/meetings/${id}/brief`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to build the brief')
      setBrief(data.brief)
      setPhase('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build the brief')
      setPhase('error')
    }
  }

  async function regenerate() {
    if (regenerating || generating) return
    setRegenerating(true)
    try {
      const res = await fetch(`/api/meetings/${id}/brief`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to regenerate')
      setBrief(data.brief)
      setSaveState('idle')
      toast.success('Brief regenerated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  function handleEdit(next: ProposalBrief) {
    setBrief(next)
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void persist(next), 1000)
  }

  async function persist(b: ProposalBrief) {
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_brief: b }),
      })
      setSaveState(res.ok ? 'saved' : 'idle')
    } catch {
      setSaveState('idle')
    }
  }

  async function generateProposal(withBrief: boolean) {
    if (generating) return
    setGenerating(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      const res = await fetch(`/api/meetings/${id}/proposal/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withBrief && brief ? { brief } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate proposal')
      router.push(`/meetings/${id}/proposal`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate proposal')
      setGenerating(false)
    }
  }

  // ── Loader (initial synthesis) ────────────────────────────────────
  if (phase === 'loading' || phase === 'generating') {
    const items: ChecklistItem[] = LOADER_STEPS.map((title, i) => ({
      id: String(i),
      title,
      state: i < step ? 'done' : i === step ? 'active' : 'pending',
    }))
    return (
      <div className="min-h-screen lg-shell flex items-center justify-center">
        <div className="flex flex-col items-center" style={{ width: 520, padding: '32px 24px' }}>
          <div className="mb-7">
            <AuroraOrb size={120} />
          </div>
          <div className="pm-eyebrow">Preparing your proposal</div>
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
            Building your proposal brief
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--ink-2)',
              textAlign: 'center',
              marginBottom: 22,
              maxWidth: 400,
              lineHeight: 1.5,
            }}
          >
            Synthesizing the transcript, your notes, the Q&amp;A, and your catalog into a clear,
            prioritized plan you can review before we write the proposal.
          </p>
          <div className="card w-full p-4">
            <Checklist items={items} />
          </div>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen lg-shell flex items-center justify-center">
        <div className="card" style={{ width: 460, padding: '24px', textAlign: 'center' }}>
          <div className="pm-eyebrow" style={{ color: 'var(--rec)' }}>
            Couldn&apos;t build the brief
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '8px 0 18px', lineHeight: 1.5 }}>
            {error ?? 'Something went wrong while synthesizing the meeting.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={generateInitial}
              className="font-medium"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                fontSize: 12.5,
                color: 'white',
                background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                border: '0.5px solid rgba(77,138,107,0.6)',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => generateProposal(false)}
              disabled={generating}
              className="font-medium disabled:opacity-50"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                fontSize: 12.5,
                color: 'var(--ink-2)',
                background: 'transparent',
                border: '0.5px solid var(--line-1)',
              }}
            >
              {generating ? 'Generating…' : 'Skip & write proposal'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Ready — review & edit ─────────────────────────────────────────
  const value = brief!
  const isEmpty =
    !value.overview &&
    value.priorities.length === 0 &&
    value.scope.length === 0 &&
    value.clientGoals.length === 0

  return (
    <div className="flex flex-col h-screen lg-shell">
      <BriefToolbar
        title={meetingTitle}
        clientCompany={clientCompany}
        saveState={saveState}
        onRegenerate={regenerate}
        regenerating={regenerating}
        onGenerate={() => generateProposal(true)}
        generating={generating}
      />

      <div className="flex-1 min-h-0 overflow-auto">
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px 24px 40px' }}>
          <div className="mb-5">
            <div className="pm-eyebrow" style={{ color: 'var(--ink-3)' }}>
              Step 1 of 2 · Before the proposal
            </div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: '4px 0 4px',
                color: 'var(--ink-1)',
              }}
            >
              Review the prioritized brief
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 560 }}>
              This is the synthesis of everything from the meeting. Edit anything, re-order the
              priorities, then generate the proposal — it&apos;s built around these items.
            </p>
          </div>

          {isEmpty && (
            <div
              className="card mb-5 flex items-start gap-2"
              style={{ padding: '10px 14px' }}
              role="status"
            >
              <span style={{ color: 'var(--accent-base)', marginTop: 1 }}>
                <Icon name="sparkle" size={13} />
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                The meeting didn&apos;t give us much to work with. Add the priorities and scope you
                have in mind, or regenerate after adding notes.
              </span>
            </div>
          )}

          <BriefReview value={value} onChange={handleEdit} disabled={regenerating || generating} />

          <div
            className="flex items-center justify-between mt-8 pt-5"
            style={{ borderTop: '0.5px solid var(--line-1)' }}
          >
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {value.generatedAt ? 'Auto-synthesized · edited copies are saved as you type' : ''}
            </span>
            <button
              type="button"
              onClick={() => generateProposal(true)}
              disabled={generating || regenerating}
              className="flex items-center gap-1.5 font-medium disabled:opacity-60"
              style={{
                height: 34,
                padding: '0 16px',
                borderRadius: 9,
                fontSize: 13,
                color: 'white',
                background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                border: '0.5px solid rgba(77,138,107,0.6)',
                cursor: generating ? 'default' : 'pointer',
              }}
            >
              {generating ? 'Generating proposal…' : 'Generate proposal'}
              {!generating && <Icon name="chevR" size={13} strokeWidth={1.8} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
