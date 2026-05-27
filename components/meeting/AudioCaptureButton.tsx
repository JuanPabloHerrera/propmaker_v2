'use client'

import { useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'

interface Props {
  meetingId: string
  onInterim: (text: string) => void
  onFinal: (text: string, speaker: string) => void
}

const FLUSH_INTERVAL_MS = 30000

export function AudioCaptureButton({ meetingId, onInterim, onFinal }: Props) {
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wordAccRef = useRef(0)
  const bufferRef = useRef<{ text: string; speaker: string }[]>([])
  const bufferedTextRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function flushBuffer() {
    if (bufferRef.current.length === 0) return
    const groups: { text: string; speaker: string }[] = []
    for (const seg of bufferRef.current) {
      const last = groups[groups.length - 1]
      if (last && last.speaker === seg.speaker) {
        last.text += ' ' + seg.text
      } else {
        groups.push({ ...seg })
      }
    }
    bufferRef.current = []
    bufferedTextRef.current = ''
    for (const g of groups) onFinal(g.text, g.speaker)
    onInterim('')
  }

  async function start() {
    setStarting(true)
    try {
      const tokenRes = await fetch('/api/deepgram-token')
      if (!tokenRes.ok) throw new Error('Deepgram not configured')
      const { key } = await tokenRes.json()

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      displayStream.getVideoTracks().forEach((t) => t.stop())
      const audioTracks = displayStream.getAudioTracks()
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach((t) => t.stop())
        throw new Error('No audio track — make sure to check "Share tab audio" in the dialog')
      }
      const audioStream = new MediaStream(audioTracks)
      streamRef.current = displayStream

      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'es',
        punctuate: 'true',
        interim_results: 'true',
        diarize: 'true',
        encoding: 'opus',
        container: 'webm',
      })
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key])
      wsRef.current = ws

      ws.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'

        const recorder = new MediaRecorder(audioStream, { mimeType })
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data)
          }
        }

        recorder.onstop = () => {
          if (ws.readyState === WebSocket.OPEN) ws.close()
        }
        recorder.start(100)
        flushTimerRef.current = setInterval(flushBuffer, FLUSH_INTERVAL_MS)
        setActive(true)
        setStarting(false)
      }

      ws.onmessage = (event) => {
        let data: { is_final?: boolean; channel?: { alternatives?: { transcript?: string; words?: { speaker?: number }[] }[] } } | null = null
        try {
          data = JSON.parse(event.data)
        } catch {
          return
        }
        if (!data) return

        const alt = data?.channel?.alternatives?.[0]
        if (!alt?.transcript?.trim()) return

        const isFinal = data.is_final === true
        const speakerNums = alt.words?.map((w) => w.speaker).filter((n): n is number => n !== undefined) ?? []
        const speakerNum = speakerNums.length > 0 ? speakerNums[0] : 0
        const speaker = `Speaker ${speakerNum + 1}`

        const text = alt.transcript.trim()
        if (isFinal) {
          bufferRef.current.push({ text, speaker })
          bufferedTextRef.current = bufferedTextRef.current
            ? bufferedTextRef.current + ' ' + text
            : text
          onInterim(bufferedTextRef.current)
          wordAccRef.current += text.split(/\s+/).filter(Boolean).length
          if (wordAccRef.current >= 40) {
            wordAccRef.current = 0
            fetch(`/api/meetings/${meetingId}/suggestions/check`, { method: 'POST' }).catch(() => {})
          }
        } else {
          const live = bufferedTextRef.current
            ? bufferedTextRef.current + ' ' + text
            : text
          onInterim(live)
        }
      }

      ws.onerror = (err) => {
        console.error('[deepgram] WebSocket error', err)
      }

      ws.onclose = () => {
        setActive(false)
      }

      audioTracks[0].onended = () => stop()
    } catch (err) {
      console.error('[audio-capture]', err)
      alert(err instanceof Error ? err.message : 'Could not start audio capture')
      setStarting(false)
      setActive(false)
    }
  }

  function stop() {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
    flushBuffer()
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close()
    wsRef.current = null
    wordAccRef.current = 0
    setActive(false)
  }

  if (active) {
    return (
      <button
        type="button"
        onClick={stop}
        className="inline-flex items-center gap-1.5"
        style={{
          height: 28,
          padding: '0 11px',
          borderRadius: 7,
          fontSize: 12,
          color: 'var(--rec)',
          background: 'rgba(217, 74, 74, 0.10)',
          border: '0.5px solid rgba(217, 74, 74, 0.25)',
        }}
      >
        <span className="dot dot-rec" />
        Stop mic
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={starting}
      className="inline-flex items-center gap-1.5 font-medium disabled:opacity-50"
      style={{
        height: 28,
        padding: '0 11px',
        borderRadius: 7,
        fontSize: 12,
        color: 'var(--ink-1)',
        background: 'rgba(255,255,255,0.6)',
        border: '0.5px solid rgba(28,24,20,0.10)',
        boxShadow:
          '0 1px 2px rgba(28,22,14,0.06), inset 0 0.5px 0 rgba(255,255,255,0.7)',
      }}
    >
      <Icon name="mic" size={12} />
      {starting ? 'Starting…' : 'Start mic'}
    </button>
  )
}
