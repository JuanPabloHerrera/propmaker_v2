'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TranscriptPanel } from '@/components/meeting/TranscriptPanel'
import { LiveChatPanel } from '@/components/meeting/LiveChatPanel'
import { useMicCapture } from '@/components/meeting/useMicCapture'
import { NotesPad } from '@/components/meeting/NotesPad'
import { CollapsiblePanel, CollapsedTab } from '@/components/meeting/CollapsiblePanel'
import { MeetingToolbar } from '@/components/meeting/MeetingToolbar'
import { CaptureStatusBar } from '@/components/meeting/CaptureStatusBar'
import { Skeleton } from '@/components/ui/skeleton'
import type { Meeting, TranscriptSegment } from '@/types'
import { toast } from 'sonner'

const LS_LEFT = 'propmaker:live:leftOpen'
const LS_RIGHT = 'propmaker:live:rightOpen'

export default function LiveMeetingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [ending, setEnding] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [joining, setJoining] = useState(false)
  const startedAtRef = useRef<number | null>(null)

  const isCompleted = meeting?.status === 'completed'
  const isConferencing =
    meeting?.capture_mode === 'both' || meeting?.capture_mode === 'recall'

  // Local microphone capture (Deepgram). Auto-started/stopped with the meeting
  // below; the CaptureStatusBar offers a manual "Enable microphone" fallback.
  const {
    start: startCapture,
    stop: stopCapture,
    active: micActive,
    status: micStatus,
    error: micError,
  } = useMicCapture({
    meetingId: id,
    onInterim: setInterimText,
    onFinal: async (text, speaker) => {
      setInterimText('')
      await activateMeetingIfNeeded()
      await supabase.from('transcript_segments').insert({
        meeting_id: id,
        speaker,
        text,
        start_time: Date.now() / 1000,
        source: 'browser',
      })
    },
    onError: (message) => toast.error(message),
  })

  useEffect(() => {
    const l = window.localStorage.getItem(LS_LEFT)
    const r = window.localStorage.getItem(LS_RIGHT)
    if (l !== null) setLeftOpen(l === '1')
    if (r !== null) setRightOpen(r === '1')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(LS_LEFT, leftOpen ? '1' : '0')
  }, [leftOpen])
  useEffect(() => {
    window.localStorage.setItem(LS_RIGHT, rightOpen ? '1' : '0')
  }, [rightOpen])

  const refetchSegments = useCallback(async () => {
    const { data } = await supabase
      .from('transcript_segments')
      .select('*')
      .eq('meeting_id', id)
      .order('created_at')
    if (data) setSegments(data as TranscriptSegment[])
  }, [id, supabase])

  const fetchInitialData = useCallback(async () => {
    const [meetingRes, segmentsRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).single(),
      supabase.from('transcript_segments').select('*').eq('meeting_id', id).order('created_at'),
    ])
    if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
    if (segmentsRes.data) setSegments(segmentsRes.data as TranscriptSegment[])
  }, [id, supabase])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // Realtime: transcript segments
  useEffect(() => {
    const channel = supabase
      .channel(`transcript-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcript_segments',
          filter: `meeting_id=eq.${id}`,
        },
        (payload) => {
          const seg = payload.new as TranscriptSegment
          setSegments((prev) =>
            prev.some((s) => s.id === seg.id) ? prev : [...prev, seg],
          )
        },
      )
      .subscribe((status) => {
        // On every (re)connect, pull the authoritative segment list. The WS can
        // drop on a brief network blip ("network connection was lost") and the
        // client silently rejoins — any INSERTs that landed while it was down
        // would otherwise be missing from the live transcript. Refetching here
        // closes that gap. The initial SUBSCRIBED just races the mount fetch
        // harmlessly (both replace with the same DB truth).
        if (status === 'SUBSCRIBED') void refetchSegments()
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, supabase, refetchSegments])

  // Realtime: meeting row updates (status changes)
  useEffect(() => {
    const channel = supabase
      .channel(`meeting-row-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as Meeting
          // For bot meetings, the recall partial stream owns the interim line:
          // show the latest word-by-word partial, and clear it (null) when the
          // utterance finalizes into a segment. Browser-mic meetings have no bot,
          // so their interim line stays driven by the local mic.
          if (updated.recall_bot_id) setInterimText(updated.live_partial ?? '')
          // Avoid re-rendering the whole page on every partial: only replace the
          // meeting object when a field we actually render changed.
          setMeeting((prev) =>
            prev &&
            prev.status === updated.status &&
            prev.recall_bot_id === updated.recall_bot_id &&
            prev.capture_mode === updated.capture_mode
              ? prev
              : updated,
          )
          if (updated.status === 'completed') {
            toast.success('Meeting ended. Processing transcript…')
            setTimeout(() => router.push(`/meetings/${id}/processing`), 800)
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, supabase, router])

  // Elapsed timer — counts up while the meeting is active.
  useEffect(() => {
    if (meeting?.status !== 'active') {
      startedAtRef.current = null
      return
    }
    if (startedAtRef.current == null) startedAtRef.current = Date.now()
    const t = setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [meeting?.status])

  async function endMeeting() {
    setEnding(true)
    await stopCapture() // flush the final transcript + release the mic
    if (meeting?.recall_bot_id) {
      await fetch(`/api/meetings/${id}/bot`, { method: 'DELETE' })
    } else {
      await fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
    }
    router.push(`/meetings/${id}/processing`)
  }

  async function activateMeetingIfNeeded() {
    if (!meeting || meeting.status === 'active' || meeting.recall_bot_id) return
    await fetch(`/api/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
  }

  // Create/join the Recall bot for a conferencing meeting that doesn't have one
  // yet (auto-join below, a failed initial join, or a scheduled meeting).
  const joinCall = useCallback(async () => {
    setJoining(true)
    try {
      const res = await fetch(`/api/meetings/${id}/bot`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(`Bot failed to join: ${data.error ?? 'Unknown error'}`)
        return
      }
      toast.success('Bot is joining the meeting…')
      await fetchInitialData() // pick up recall_bot_id + status='active'
    } finally {
      setJoining(false)
    }
  }, [id, fetchInitialData])

  // Auto-join the bot for a conferencing meeting that has a URL but no bot yet
  // (no manual button needed). Guarded per meeting id so it can't double-create;
  // the CaptureStatusBar "Join the call" button remains as a manual retry.
  const autoJoinedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!meeting || isCompleted) return
    const isConf = meeting.capture_mode === 'both' || meeting.capture_mode === 'recall'
    if (!isConf || !meeting.meeting_url || meeting.recall_bot_id) return
    if (autoJoinedRef.current === meeting.id) return
    autoJoinedRef.current = meeting.id
    void joinCall()
  }, [
    meeting?.id,
    meeting?.capture_mode,
    meeting?.meeting_url,
    meeting?.recall_bot_id,
    isCompleted,
    joinCall,
  ])

  // Poll transcript_segments every 5s while the meeting is active — a safety net
  // for any capture mode in case Supabase Realtime isn't delivering (e.g. not
  // enabled on the project). The full re-select is the source of truth, so it
  // also reconciles any duplicates from the Realtime append above.
  useEffect(() => {
    if (meeting?.status !== 'active') return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('transcript_segments')
        .select('*')
        .eq('meeting_id', id)
        .order('created_at')
      if (data) setSegments(data as TranscriptSegment[])
    }, 5000)
    return () => clearInterval(interval)
  }, [meeting?.status, id, supabase])

  // Auto-start local mic capture once the meeting loads, for the modes that use
  // the browser mic ('browser' = local mic, 'both' = conferencing bot + mic).
  // Stops on unmount or when the meeting completes. (Recall-only meetings don't
  // capture the local mic.) Keyed on id/capture_mode/isCompleted so realtime
  // status flips (pending→active) don't restart capture.
  useEffect(() => {
    if (!meeting || isCompleted) return
    const usesBrowserMic = meeting.capture_mode === 'browser' || meeting.capture_mode === 'both'
    if (!usesBrowserMic) return
    void startCapture()
    // Local-mic-only meetings have no bot to flip status, so activate now → REC.
    if (meeting.capture_mode === 'browser') void activateMeetingIfNeeded()
    return () => {
      void stopCapture()
    }
  }, [meeting?.id, meeting?.capture_mode, isCompleted, startCapture, stopCapture])

  if (!meeting) {
    return (
      <div
        className="flex-1 flex flex-col lg-shell"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading meeting…</span>
        <div
          className="flex items-center gap-3 shrink-0"
          style={{ padding: '14px 24px', borderBottom: '0.5px solid var(--line-1)' }}
        >
          <Skeleton style={{ height: 14, width: 240 }} />
          <div className="flex-1" />
          <Skeleton style={{ height: 24, width: 60, borderRadius: 999 }} />
          <Skeleton style={{ height: 28, width: 84, borderRadius: 8 }} />
        </div>
        <div className="flex-1 grid grid-cols-[1fr_1.4fr_1fr] gap-0">
          <div style={{ padding: '20px 18px', borderRight: '0.5px solid var(--line-1)' }}>
            <Skeleton style={{ height: 12, width: 100, marginBottom: 14 }} />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                style={{ height: 10, width: `${60 + ((i * 13) % 35)}%`, marginBottom: 10 }}
              />
            ))}
          </div>
          <div style={{ padding: '20px 24px' }}>
            <Skeleton style={{ height: 18, width: '50%', marginBottom: 16 }} />
            <Skeleton style={{ height: 14, width: '100%', marginBottom: 8 }} />
            <Skeleton style={{ height: 14, width: '92%', marginBottom: 8 }} />
            <Skeleton style={{ height: 14, width: '80%' }} />
          </div>
          <div style={{ padding: '20px 18px', borderLeft: '0.5px solid var(--line-1)' }}>
            <Skeleton style={{ height: 12, width: 80, marginBottom: 14 }} />
            <Skeleton style={{ height: 52, width: '100%', borderRadius: 10, marginBottom: 8 }} />
            <Skeleton style={{ height: 52, width: '100%', borderRadius: 10 }} />
          </div>
        </div>
      </div>
    )
  }

  const isRecording = meeting.status === 'active'

  return (
    <div className="flex flex-col h-screen lg-shell">
      <MeetingToolbar
        meeting={meeting}
        elapsedSeconds={elapsed}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        onEnd={endMeeting}
        ending={ending}
        segmentCount={segments.length}
      />

      {!isCompleted && (
        <CaptureStatusBar
          captureMode={meeting.capture_mode}
          micStatus={micStatus}
          micError={micError}
          onEnableMic={() => void startCapture()}
          isConferencing={isConferencing}
          botJoined={Boolean(meeting.recall_bot_id && meeting.status === 'active')}
          hasMeetingUrl={Boolean(meeting.meeting_url)}
          joining={joining}
          onJoinBot={joinCall}
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {leftOpen ? (
          <CollapsiblePanel
            side="left"
            label="Transcript"
            open={leftOpen}
            onToggle={() => setLeftOpen(false)}
          >
            <TranscriptPanel
              segments={segments}
              interimText={interimText}
              isRecording={isRecording}
              elapsedSeconds={elapsed}
              botActive={Boolean(
                isConferencing && meeting.recall_bot_id && meeting.status === 'active',
              )}
              micActive={micActive}
            />
          </CollapsiblePanel>
        ) : (
          <CollapsedTab side="left" label="Transcript" onClick={() => setLeftOpen(true)} />
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <NotesPad
            meetingId={id}
            initialJson={meeting.notes_json}
            remoteJson={meeting.notes_json}
          />
        </div>

        {rightOpen ? (
          <CollapsiblePanel
            side="right"
            label="Co-pilot"
            open={rightOpen}
            onToggle={() => setRightOpen(false)}
          >
            <LiveChatPanel meetingId={id} />
          </CollapsiblePanel>
        ) : (
          <CollapsedTab side="right" label="Co-pilot" onClick={() => setRightOpen(true)} />
        )}
      </div>
    </div>
  )
}
