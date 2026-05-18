'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TranscriptPanel } from '@/components/meeting/TranscriptPanel'
import { LiveChatPanel } from '@/components/meeting/LiveChatPanel'
import { AudioCaptureButton } from '@/components/meeting/AudioCaptureButton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Meeting, TranscriptSegment } from '@/types'
import { toast } from 'sonner'
import Link from 'next/link'

export default function LiveMeetingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [ending, setEnding] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    setIsLocalhost(
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    )
  }, [])

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
        { event: 'INSERT', schema: 'public', table: 'transcript_segments', filter: `meeting_id=eq.${id}` },
        (payload) => {
          setSegments((prev) => [...prev, payload.new as TranscriptSegment])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, supabase])

  // Realtime: meeting status change
  useEffect(() => {
    const channel = supabase
      .channel(`meeting-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meetings', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Meeting
          setMeeting(updated)
          if (updated.status === 'completed') {
            toast.success('Meeting ended. Redirecting to proposal…')
            setTimeout(() => router.push(`/meetings/${id}/proposal`), 1500)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, supabase, router])

  async function endMeeting() {
    setEnding(true)
    await fetch(`/api/meetings/${id}/bot`, { method: 'DELETE' })
    toast.success('Meeting ended.')
    router.push(`/meetings/${id}/proposal`)
  }

  const silentSync = useCallback(async () => {
    const res = await fetch(`/api/meetings/${id}/sync`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      if (data.synced > 0) fetchInitialData()
      setLastSynced(new Date())
    }
  }, [id, fetchInitialData])

  // Auto-poll on localhost every 10s — only when the meeting has a bot
  useEffect(() => {
    if (!isLocalhost || !meeting?.recall_bot_id) return
    const interval = setInterval(() => {
      silentSync()
    }, 10000)
    return () => clearInterval(interval)
  }, [isLocalhost, meeting?.recall_bot_id, silentSync])

  // Poll transcript_segments directly every 5s as Realtime fallback
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

  async function syncTranscript() {
    setSyncing(true)
    const res = await fetch(`/api/meetings/${id}/sync`, { method: 'POST' })
    const data = await res.json()
    setSyncing(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Sync failed')
    } else if (data.synced === 0) {
      toast('No transcript yet — Recall.ai may still be processing.')
    } else {
      toast.success(`Synced ${data.synced} segments`)
      fetchInitialData()
      setLastSynced(new Date())
    }
  }

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[#6e6e73]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#d2d2d7] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">←</Link>
          <div className="flex items-center gap-2">
            {meeting.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-red-500 live-pulse" />
            )}
            <h2 className="text-sm font-semibold text-[#1d1d1f]">{meeting.title}</h2>
          </div>
          <Badge
            variant="outline"
            className={meeting.status === 'active' ? 'bg-red-50 text-red-600 border-red-200 text-xs' : 'text-xs'}
          >
            {meeting.status === 'active' ? 'Live' : meeting.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6e6e73]">{segments.length} segments</span>
          {isLocalhost && (
            <>
              {lastSynced && (
                <span className="text-xs text-[#6e6e73]">
                  synced {Math.round((Date.now() - lastSynced.getTime()) / 1000)}s ago
                </span>
              )}
              <Button
                onClick={syncTranscript}
                disabled={syncing}
                variant="outline"
                size="sm"
                className="rounded-lg border-[#d2d2d7] text-[#6e6e73] h-8 text-xs hover:bg-[#f5f5f7]"
              >
                {syncing ? 'Syncing…' : '↓ Sync'}
              </Button>
            </>
          )}
          {meeting.status !== 'completed' && (
            <Button
              onClick={endMeeting}
              disabled={ending}
              variant="outline"
              size="sm"
              className="rounded-lg border-[#d2d2d7] text-[#1d1d1f] h-8 text-xs hover:bg-[#f5f5f7]"
            >
              {ending ? 'Ending…' : 'End meeting'}
            </Button>
          )}
          {meeting.status === 'completed' && (
            <Link
              href={`/meetings/${id}/proposal`}
              className={buttonVariants({ size: 'sm', className: 'rounded-lg! bg-[#1d1d1f] text-white h-8 text-xs hover:bg-[#2d2d2f]' })}
            >
              View proposal →
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Transcript */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[#d2d2d7] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">Transcript</span>
            {meeting.status === 'active' && (
              <AudioCaptureButton
                meetingId={id}
                onInterim={setInterimText}
                onFinal={async (text, speaker) => {
                  setInterimText('')
                  await supabase.from('transcript_segments').insert({
                    meeting_id: id,
                    speaker,
                    text,
                    start_time: Date.now() / 1000,
                  })
                }}
              />
            )}
          </div>
          <TranscriptPanel segments={segments} interimText={interimText} />
        </div>

        {/* AI Co-pilot Chat */}
        <LiveChatPanel meetingId={id} />
      </div>
    </div>
  )
}
