'use client'

import type { CaptureMode } from '@/types'
import type { MicStatus } from '@/components/meeting/useMicCapture'

interface Props {
  captureMode: CaptureMode
  micStatus: MicStatus
  micError: string | null
  onEnableMic: () => void
  isConferencing: boolean
  /** Bot exists and the meeting is live. */
  botJoined: boolean
  hasMeetingUrl: boolean
  joining: boolean
  onJoinBot: () => void
}

/**
 * Slim strip under the meeting toolbar that confirms the live capture sources
 * are actually recording — the local mic (browser/both modes) and the Recall
 * bot (conferencing) — and offers one-click recovery when either isn't running.
 */
export function CaptureStatusBar({
  captureMode,
  micStatus,
  micError,
  onEnableMic,
  isConferencing,
  botJoined,
  hasMeetingUrl,
  joining,
  onJoinBot,
}: Props) {
  const usesMic = captureMode === 'browser' || captureMode === 'both'
  if (!usesMic && !isConferencing) return null

  const micOk = micStatus === 'recording'
  const micPending = micStatus === 'starting'
  const micNeedsAttention = usesMic && !micOk && !micPending
  const botNeedsAttention = isConferencing && !botJoined
  const needsAttention = micNeedsAttention || botNeedsAttention

  return (
    <div
      className="flex items-center gap-x-4 gap-y-1.5 shrink-0 flex-wrap"
      style={{
        padding: '8px 16px',
        borderBottom: '0.5px solid var(--line-1)',
        background: needsAttention ? 'rgba(217,138,74,0.10)' : 'rgba(77,138,107,0.07)',
      }}
      role="status"
    >
      {usesMic && (
        <Chip
          ok={micOk}
          pending={micPending}
          label={micOk ? 'Mic recording' : micPending ? 'Starting mic…' : 'Mic off'}
          detail={micNeedsAttention ? micError ?? 'The microphone isn’t recording.' : null}
          action={micNeedsAttention ? { label: 'Enable microphone', onClick: onEnableMic } : null}
        />
      )}

      {isConferencing && (
        <Chip
          ok={botJoined}
          pending={false}
          label={botJoined ? 'Bot in call' : 'Bot not joined'}
          detail={
            botNeedsAttention
              ? hasMeetingUrl
                ? 'Remote participants aren’t transcribed until the bot joins.'
                : 'No meeting link was set, so the bot can’t join this call.'
              : null
          }
          action={
            botNeedsAttention && hasMeetingUrl
              ? { label: joining ? 'Joining…' : 'Join the call', onClick: onJoinBot, disabled: joining }
              : null
          }
        />
      )}
    </div>
  )
}

interface ChipProps {
  ok: boolean
  pending: boolean
  label: string
  detail: string | null
  action: { label: string; onClick: () => void; disabled?: boolean } | null
}

function Chip({ ok, pending, label, detail, action }: ChipProps) {
  const color = ok ? 'var(--accent-base)' : pending ? 'var(--ink-3)' : '#c77a2e'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={pending ? 'animate-pulse' : ''}
        style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }}
      />
      <span className="text-[12px] font-semibold" style={{ color: 'var(--ink-1)' }}>
        {label}
      </span>
      {detail && (
        <span className="text-[11px] truncate" style={{ color: 'var(--ink-2)' }}>
          {detail}
        </span>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="inline-flex items-center justify-center font-medium shrink-0"
          style={{
            height: 24,
            padding: '0 10px',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'white',
            background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
            border: '0.5px solid rgba(77,138,107,0.6)',
            opacity: action.disabled ? 0.6 : 1,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
