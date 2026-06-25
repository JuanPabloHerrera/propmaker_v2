'use client'

import { useCallback, useRef, useState } from 'react'

const FLUSH_INTERVAL_MS = 30000

interface Options {
  meetingId: string
  onInterim: (text: string) => void
  onFinal: (text: string, speaker: string) => void | Promise<void>
  onError?: (message: string) => void
}

/**
 * Headless local-microphone capture → Deepgram streaming → onFinal/onInterim.
 *
 * Mic only (`getUserMedia`); the conferencing call audio is captured separately
 * by the Recall bot. `start()`/`stop()` are stable and idempotent: a generation
 * counter cancels any in-flight `start()` when `stop()` runs, so React StrictMode's
 * mount→cleanup→mount in dev can't leave a dangling stream. `stop()` is async and
 * awaits the final buffer flush so the last transcript is persisted before the
 * caller navigates away.
 */
export function useMicCapture({ meetingId, onInterim, onFinal, onError }: Options) {
  const [active, setActive] = useState(false)

  // Latest callbacks without forcing start/stop to be recreated.
  const onInterimRef = useRef(onInterim)
  const onFinalRef = useRef(onFinal)
  const onErrorRef = useRef(onError)
  onInterimRef.current = onInterim
  onFinalRef.current = onFinal
  onErrorRef.current = onError

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const wordAccRef = useRef(0)
  const bufferRef = useRef<{ text: string; speaker: string }[]>([])
  const bufferedTextRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runningRef = useRef(false)
  const genRef = useRef(0)

  const flushBuffer = useCallback(async () => {
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
    for (const g of groups) await onFinalRef.current(g.text, g.speaker)
    onInterimRef.current('')
  }, [])

  const stop = useCallback(async () => {
    genRef.current++ // invalidate any in-flight start()
    if (!runningRef.current) return
    runningRef.current = false
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
    await flushBuffer()
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close()
    wsRef.current = null
    wordAccRef.current = 0
    setActive(false)
  }, [flushBuffer])

  const start = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    const gen = ++genRef.current
    const aborted = () => gen !== genRef.current
    try {
      const tokenRes = await fetch('/api/deepgram-token')
      if (!tokenRes.ok) throw new Error('Deepgram not configured')
      const { key } = await tokenRes.json()
      if (aborted()) return

      let micStream: MediaStream
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
      } catch {
        throw new Error('Microphone permission denied — allow mic access and try again')
      }
      if (aborted()) {
        micStream.getTracks().forEach((t) => t.stop())
        return
      }
      micStreamRef.current = micStream

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
        if (aborted()) {
          ws.close()
          return
        }
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'

        const recorder = new MediaRecorder(micStream, { mimeType })
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
        flushTimerRef.current = setInterval(() => {
          void flushBuffer()
        }, FLUSH_INTERVAL_MS)
        setActive(true)
      }

      ws.onmessage = (event) => {
        let data:
          | { is_final?: boolean; channel?: { alternatives?: { transcript?: string; words?: { speaker?: number }[] }[] } }
          | null = null
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
          bufferedTextRef.current = bufferedTextRef.current ? bufferedTextRef.current + ' ' + text : text
          onInterimRef.current(bufferedTextRef.current)
          wordAccRef.current += text.split(/\s+/).filter(Boolean).length
          if (wordAccRef.current >= 40) {
            wordAccRef.current = 0
            fetch(`/api/meetings/${meetingId}/suggestions/check`, { method: 'POST' }).catch(() => {})
          }
        } else {
          const live = bufferedTextRef.current ? bufferedTextRef.current + ' ' + text : text
          onInterimRef.current(live)
        }
      }

      ws.onerror = (err) => {
        console.error('[deepgram] WebSocket error', err)
      }

      ws.onclose = () => {
        setActive(false)
      }

      // End capture if the mic device itself is stopped (unplugged / revoked).
      micStream.getAudioTracks()[0].onended = () => {
        void stop()
      }
    } catch (err) {
      console.error('[mic-capture]', err)
      runningRef.current = false
      setActive(false)
      onErrorRef.current?.(err instanceof Error ? err.message : 'Could not start audio capture')
    }
  }, [flushBuffer, meetingId, stop])

  return { active, start, stop }
}
