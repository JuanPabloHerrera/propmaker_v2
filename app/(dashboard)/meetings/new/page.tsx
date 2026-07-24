'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/ui/pill'
import { FieldError } from '@/components/ui/field-error'
import { InsufficientCreditsModal } from '@/components/billing/InsufficientCreditsModal'
import { MEETING_START_MIN_CREDITS } from '@/lib/billing/plans'

type JoinMode = 'local' | 'online'

export default function NewMeetingPage() {
  const router = useRouter()

  const [mode, setMode] = React.useState<JoinMode>('local')
  const [meetingUrl, setMeetingUrl] = React.useState('')
  const [urlError, setUrlError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  // Remembers a meeting created in a prior attempt whose bot failed to join, so
  // retrying reuses it instead of creating duplicate meetings.
  const [createdMeetingId, setCreatedMeetingId] = React.useState<string | null>(null)
  // Shown when the balance can't cover at least one document (meeting-start gate).
  const [insufficientOpen, setInsufficientOpen] = React.useState(false)
  const [creditBalance, setCreditBalance] = React.useState(0)
  const urlRef = React.useRef<HTMLInputElement>(null)

  async function join(selected: JoinMode) {
    if (selected === 'online') {
      const url = meetingUrl.trim()
      if (!url) {
        setUrlError('Paste the meeting link so the bot can join.')
        urlRef.current?.focus()
        return
      }
      if (!/^https?:\/\/\S+\.\S+/.test(url)) {
        setUrlError('Looks like an invalid URL.')
        urlRef.current?.focus()
        return
      }
    }

    // Gate before creating anything: a meeting is only worth starting if it can
    // become at least one document afterwards. The authoritative check is the
    // 402 from POST /api/meetings below; this is the fast UX path.
    const creditsRes = await fetch('/api/credits')
      .then((r) => r.json())
      .catch(() => null)
    const balance = creditsRes?.balance ?? 0
    if (balance < MEETING_START_MIN_CREDITS) {
      setCreditBalance(balance)
      setInsufficientOpen(true)
      return
    }

    setLoading(true)

    let meetingId = createdMeetingId
    if (!meetingId) {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: selected,
          meeting_url: selected === 'online' ? meetingUrl.trim() : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoading(false)
        // Credits drained between the pre-check and creation — surface the same modal.
        if (data.code === 'INSUFFICIENT_CREDITS') {
          setCreditBalance(data.balance ?? 0)
          setInsufficientOpen(true)
          return
        }
        toast.error(data.error ?? 'Failed to create meeting')
        return
      }
      meetingId = data.id as string
    }

    if (selected === 'online') {
      const botRes = await fetch(`/api/meetings/${meetingId}/bot`, { method: 'POST' })
      const botData = await botRes.json().catch(() => ({}))
      if (!botRes.ok) {
        // Keep the user here with the meeting saved so they can fix the URL /
        // credentials and retry — don't drop them on a botless live page.
        setCreatedMeetingId(meetingId)
        setLoading(false)
        toast.error(`Bot failed to join: ${botData.error ?? 'Unknown error'}. Fix the link and try again.`)
        return
      }
      toast.success('Bot is joining the meeting…')
    }
    router.push(`/meetings/${meetingId}/live`)
  }

  const tileStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 14,
    padding: '22px 20px',
    textAlign: 'left',
    cursor: 'pointer',
    border: active ? '1px solid rgba(77,138,107,0.35)' : '1px solid var(--hairline)',
    background: active ? 'var(--accent-soft)' : undefined,
    boxShadow: active ? '0 1px 3px var(--accent-glow)' : undefined,
  })

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px', maxWidth: 720 }}>
      <Link
        href="/"
        className="inline-flex items-center gap-1 mb-3"
        style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
      >
        <Icon name="chevL" size={12} />
        Back
      </Link>

      <div className="pm-eyebrow">New meeting</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        Join a meeting
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 22 }}>
        Pick how to capture it — the title, client, and context are detected
        automatically from the conversation afterwards.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          className="card"
          style={tileStyle(mode === 'local')}
          onClick={() => {
            setMode('local')
            void join('local')
          }}
          disabled={loading}
        >
          <div className="flex items-center justify-between mb-2">
            <Icon name="mic" size={20} />
            <Pill mono>DEEPGRAM · STREAMING</Pill>
          </div>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--ink-1)' }}>
            Local mic
          </div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>
            In-person or in-room meeting. Starts capturing from this device&apos;s
            microphone immediately.
          </div>
        </button>

        <div
          className="card"
          style={tileStyle(mode === 'online')}
          onClick={() => setMode('online')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setMode('online')
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <Icon name="vid" size={20} />
            <Pill mono>RECALL · BOT</Pill>
          </div>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--ink-1)' }}>
            Online meeting
          </div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>
            Zoom, Meet, or Teams. Paste the link and the notetaker bot joins the
            call for you.
          </div>

          {mode === 'online' && (
            <div className="mt-3">
              <input
                ref={urlRef}
                className="field"
                style={{ height: 36, fontSize: 13 }}
                placeholder="https://meet.google.com/…"
                value={meetingUrl}
                onChange={(e) => {
                  setMeetingUrl(e.target.value)
                  if (urlError) setUrlError(null)
                }}
                onClick={(e) => e.stopPropagation()}
                aria-invalid={Boolean(urlError)}
                aria-describedby="url-error"
              />
              <FieldError id="url-error" message={urlError} />
              <button
                type="button"
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation()
                  void join('online')
                }}
                className="inline-flex items-center justify-center gap-2 text-white font-medium mt-2 w-full"
                style={{
                  height: 38,
                  fontSize: 13,
                  borderRadius: 9,
                  background:
                    'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                  border: '0.5px solid rgba(77,138,107,0.6)',
                  boxShadow:
                    '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                <Icon name="bot" size={14} />
                {loading ? 'Joining…' : 'Join with bot'}
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && mode === 'local' && (
        <p className="mt-4" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          Setting up your meeting…
        </p>
      )}

      <InsufficientCreditsModal
        open={insufficientOpen}
        balance={creditBalance}
        context="meeting"
        onClose={() => setInsufficientOpen(false)}
      />
    </div>
  )
}
