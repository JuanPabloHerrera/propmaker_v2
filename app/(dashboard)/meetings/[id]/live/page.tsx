'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TranscriptPanel } from '@/components/meeting/TranscriptPanel'
import { LiveChatPanel } from '@/components/meeting/LiveChatPanel'
import { AudioCaptureButton } from '@/components/meeting/AudioCaptureButton'
import { NotesPad } from '@/components/meeting/NotesPad'
import { CollapsiblePanel, CollapsedTab } from '@/components/meeting/CollapsiblePanel'
import { MeetingToolbar } from '@/components/meeting/MeetingToolbar'
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
  const startedAtRef = useRef<number | null>(null)

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
          setSegments((prev) => [...prev, payload.new as TranscriptSegment])
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, supabase])

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
          setMeeting(updated)
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

  // Poll transcript_segments every 5s while a bot is active — Realtime fallback.
  useEffect(() => {
    if (!meeting?.recall_bot_id || meeting.status !== 'active') return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('transcript_segments')
        .select('*')
        .eq('meeting_id', id)
        .order('created_at')
      if (data) setSegments(data as TranscriptSegment[])
    }, 5000)
    return () => clearInterval(interval)
  }, [meeting?.recall_bot_id, meeting?.status, id, supabase])

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center lg-shell">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Loading…
        </p>
      </div>
    )
  }

  const isCompleted = meeting.status === 'completed'
  const isRecording = meeting.status === 'active'

  const micButton = isCompleted ? null : (
    <AudioCaptureButton
      meetingId={id}
      onInterim={setInterimText}
      onFinal={async (text, speaker) => {
        setInterimText('')
        await activateMeetingIfNeeded()
        await supabase.from('transcript_segments').insert({
          meeting_id: id,
          speaker,
          text,
          start_time: Date.now() / 1000,
          source: 'browser',
        })
      }}
    />
  )

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
        micSlot={micButton}
        segmentCount={segments.length}
      />

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
