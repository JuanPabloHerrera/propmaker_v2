'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { AttendeePillRow } from '@/components/meeting/AttendeePillRow'
import { CaptureMethodTiles } from '@/components/meeting/CaptureMethodTiles'
import { ContextTextarea } from '@/components/meeting/ContextTextarea'
import { ProductAttachList } from '@/components/meeting/ProductAttachList'
import { AgentSuggestionCard } from '@/components/meeting/AgentSuggestionCard'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/ui/pill'
import type { CaptureMode, MeetingAttendee, MeetingType, Product } from '@/types'
import { MEETING_TYPE_LABELS } from '@/types'

type JoinMode = 'now' | 'schedule'

export default function NewMeetingPage() {
  const router = useRouter()

  const [title, setTitle] = React.useState('')
  const [clientCompany, setClientCompany] = React.useState('')
  const [meetingType, setMeetingType] = React.useState<MeetingType>('consulting')
  const [meetingUrl, setMeetingUrl] = React.useState('')
  const [captureMode, setCaptureMode] = React.useState<CaptureMode>('browser')
  const [joinMode, setJoinMode] = React.useState<JoinMode>('now')
  const [scheduledAt, setScheduledAt] = React.useState('')
  const [attendees, setAttendees] = React.useState<MeetingAttendee[]>([])
  const [contextSummary, setContextSummary] = React.useState('')
  const [products, setProducts] = React.useState<Product[]>([])
  const [attachedIds, setAttachedIds] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/products')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: Product[]) => {
        setProducts(list.filter((p) => p.active))
      })
      .catch(() => {})
  }, [])

  const needsUrl = captureMode === 'recall' || captureMode === 'both'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const selectedCategories = Array.from(
      new Set(
        products
          .filter((p) => attachedIds.includes(p.id))
          .map((p) => p.category),
      ),
    )

    const body: Record<string, unknown> = {
      title,
      meeting_type: meetingType,
      capture_mode: captureMode,
      selected_categories: selectedCategories,
      attendees,
      context_summary: contextSummary || null,
      client_company: clientCompany || null,
      attached_product_ids: attachedIds,
    }
    if (needsUrl) body.meeting_url = meetingUrl
    if (joinMode === 'schedule' && scheduledAt) {
      body.scheduled_at = new Date(scheduledAt).toISOString()
    }

    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setLoading(false)
      toast.error(data.error ?? 'Failed to create meeting')
      return
    }

    if (joinMode === 'now') {
      if (captureMode === 'recall' || captureMode === 'both') {
        const botRes = await fetch(`/api/meetings/${data.id}/bot`, { method: 'POST' })
        const botData = await botRes.json()
        if (!botRes.ok) {
          toast.error(`Bot failed to join: ${botData.error ?? 'Unknown error'}`)
        } else {
          toast.success('Bot is joining the meeting…')
        }
      }
      router.push(`/meetings/${data.id}/live`)
    } else {
      setLoading(false)
      toast.success('Meeting scheduled.')
      router.push('/')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <Link
        href="/"
        className="inline-flex items-center gap-1 mb-3"
        style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
      >
        <Icon name="chevL" size={12} />
        Back
      </Link>

      <div className="pm-eyebrow">New meeting</div>
      <h1 className="pm-h1" style={{ marginBottom: 22 }}>
        Set up your session
      </h1>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: '1.4fr 1fr' }}
      >
        {/* Left column */}
        <div className="flex flex-col gap-3.5">
          <div className="card p-5">
            <label className="block">
              <span
                className="block text-[11px] font-medium mb-1.5"
                style={{ color: 'var(--ink-2)' }}
              >
                Meeting title
              </span>
              <input
                className="field"
                style={{ height: 38, fontSize: 14 }}
                placeholder="e.g. Discovery call — Acme Coffee"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="block">
                <span
                  className="block text-[11px] font-medium mb-1.5"
                  style={{ color: 'var(--ink-2)' }}
                >
                  Client / Company
                </span>
                <input
                  className="field"
                  placeholder="Acme Coffee"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                />
              </label>
              <label className="block">
                <span
                  className="block text-[11px] font-medium mb-1.5"
                  style={{ color: 'var(--ink-2)' }}
                >
                  Start
                </span>
                <div className="flex gap-1.5">
                  {(['now', 'schedule'] as JoinMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setJoinMode(m)}
                      className="pill cursor-pointer"
                      style={{
                        height: 30,
                        fontSize: 12,
                        padding: '0 12px',
                        background:
                          joinMode === m ? 'var(--accent-soft)' : undefined,
                        color: joinMode === m ? 'var(--accent-base)' : undefined,
                        borderColor:
                          joinMode === m
                            ? 'rgba(77,138,107,0.2)'
                            : undefined,
                      }}
                    >
                      {m === 'now' ? 'Now' : 'Schedule'}
                    </button>
                  ))}
                </div>
                {joinMode === 'schedule' && (
                  <input
                    type="datetime-local"
                    className="field mt-1.5"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                )}
              </label>
            </div>

            <div className="mt-3">
              <span
                className="block text-[11px] font-medium mb-1.5"
                style={{ color: 'var(--ink-2)' }}
              >
                Meeting type
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMeetingType(t)}
                    className="pill cursor-pointer"
                    style={{
                      height: 26,
                      fontSize: 11.5,
                      padding: '0 12px',
                      background:
                        meetingType === t ? 'var(--accent-soft)' : undefined,
                      color:
                        meetingType === t ? 'var(--accent-base)' : undefined,
                      borderColor:
                        meetingType === t ? 'rgba(77,138,107,0.2)' : undefined,
                    }}
                  >
                    {MEETING_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <span
                className="block text-[11px] font-medium mb-1.5"
                style={{ color: 'var(--ink-2)' }}
              >
                Attendees
              </span>
              <AttendeePillRow value={attendees} onChange={setAttendees} />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                Capture method
              </div>
              <Pill mono>DEEPGRAM · STREAMING</Pill>
            </div>
            <CaptureMethodTiles
              value={captureMode}
              onChange={setCaptureMode}
              meetingUrl={meetingUrl}
              onMeetingUrlChange={setMeetingUrl}
            />
          </div>

          <ContextTextarea value={contextSummary} onChange={setContextSummary} />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3.5">
          <ProductAttachList
            products={products}
            selectedIds={attachedIds}
            onChange={setAttachedIds}
          />

          <AgentSuggestionCard>
            Attach the products you think are most relevant — the agent will use them as anchors when
            drafting the proposal after the call.
          </AgentSuggestionCard>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 text-white font-medium mt-auto"
            style={{
              height: 40,
              padding: '0 16px',
              fontSize: 13.5,
              borderRadius: 9,
              background:
                'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
              border: '0.5px solid rgba(77,138,107,0.6)',
              boxShadow:
                '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <Icon name="mic" />
            {loading
              ? 'Setting up…'
              : joinMode === 'now'
                ? 'Start meeting & let agent join'
                : 'Schedule meeting'}
          </button>
        </div>
      </div>
    </form>
  )
}
