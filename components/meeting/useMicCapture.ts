'use client'

import { useCallback, useRef, useState } from 'react'

// Persist finalized segments promptly so the live transcript renders in near
// real time (and doesn't visibly reset when interim clears). Consecutive
// same-speaker finals within the window are still grouped in flushBuffer.
const FLUSH_INTERVAL_MS = 2000

export type MicStatus = 'idle' | 'starting' | 'recording' | 'error'

interface Options {
  meetingId: string
  onInterim: (text: string) => void
  onFinal: (text: string, speaker: string) => void | Promise<void>
  onError?: (message: string) => void
}

// AudioWorklet module (loaded via a Blob URL): downsamples nothing, just batches
// the mic's Float32 frames into ~2048-sample chunks, converts to 16-bit PCM, and
// posts the raw bytes back to the main thread for the Deepgram socket. Using raw
// PCM (linear16) instead of MediaRecorder(webm/opus) is what makes capture work
// in every browser — Safari/Firefox don't support MediaRecorder WebM.
const WORKLET_SRC = `
class PCMCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) {
        const p = new Int16Array(this.buf.length);
        for (let j = 0; j < p.length; j++) {
          let s = Math.max(-1, Math.min(1, this.buf[j]));
          p[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(p.buffer, [p.buffer]);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCapture);
`

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Allow it in your browser’s site settings, then click Enable microphone.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Connect a mic and try again.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Your microphone is in use by another app. Close it and try again.'
    default:
      return err instanceof Error && err.message ? err.message : 'Could not start the microphone.'
  }
}

/**
 * Headless local-microphone capture → Deepgram streaming → onFinal/onInterim.
 *
 * Mic only (`getUserMedia`); the conferencing call audio is captured separately
 * by the Recall bot. Audio is streamed as raw linear16 PCM via a Web Audio graph
 * (AudioWorklet, with a ScriptProcessor fallback), so it works across Chrome,
 * Safari and Firefox. `start()`/`stop()` are stable and idempotent: a generation
 * counter cancels any in-flight `start()` when `stop()` runs, so React StrictMode's
 * mount→cleanup→mount in dev can't leave a dangling stream. `stop()` is async and
 * awaits the final buffer flush so the last transcript is persisted before the
 * caller navigates away.
 */
export function useMicCapture({ meetingId, onInterim, onFinal, onError }: Options) {
  const [status, setStatus] = useState<MicStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Latest callbacks without forcing start/stop to be recreated.
  const onInterimRef = useRef(onInterim)
  const onFinalRef = useRef(onFinal)
  const onErrorRef = useRef(onError)
  onInterimRef.current = onInterim
  onFinalRef.current = onFinal
  onErrorRef.current = onError

  const wsRef = useRef<WebSocket | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const scriptRef = useRef<ScriptProcessorNode | null>(null)
  const sinkRef = useRef<GainNode | null>(null)
  const blobUrlRef = useRef<string | null>(null)
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

  // Tear down the audio graph + socket. Safe to call repeatedly; operates on refs.
  const teardown = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
    try {
      srcRef.current?.disconnect()
    } catch {}
    if (workletRef.current) {
      workletRef.current.port.onmessage = null
      try {
        workletRef.current.disconnect()
      } catch {}
      workletRef.current = null
    }
    if (scriptRef.current) {
      scriptRef.current.onaudioprocess = null
      try {
        scriptRef.current.disconnect()
      } catch {}
      scriptRef.current = null
    }
    try {
      sinkRef.current?.disconnect()
    } catch {}
    srcRef.current = null
    sinkRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close()
    wsRef.current = null
    wordAccRef.current = 0
  }, [])

  const stop = useCallback(async () => {
    genRef.current++ // invalidate any in-flight start()
    const wasRunning = runningRef.current
    runningRef.current = false
    if (wasRunning) await flushBuffer()
    teardown()
    setStatus('idle')
    setError(null)
  }, [flushBuffer, teardown])

  const start = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    const gen = ++genRef.current
    const aborted = () => gen !== genRef.current
    setStatus('starting')
    setError(null)

    // Resources for THIS invocation; cleaned via locals if we get aborted mid-await
    // so we never touch a newer start()'s refs.
    let micStream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let ws: WebSocket | null = null
    let url: string | null = null
    const cleanupLocal = () => {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close()
      } catch {}
      ctx?.close().catch(() => {})
      micStream?.getTracks().forEach((t) => t.stop())
      if (url) URL.revokeObjectURL(url)
    }

    try {
      const tokenRes = await fetch('/api/deepgram-token')
      if (!tokenRes.ok) throw new Error('Deepgram is not configured (missing API key).')
      const { key } = await tokenRes.json()
      if (aborted()) return

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (aborted()) return cleanupLocal()
      micStreamRef.current = micStream

      const AudioCtx: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AudioCtx()
      audioCtxRef.current = ctx
      await ctx.resume() // a no-op once a user gesture has unlocked audio
      if (aborted()) return cleanupLocal()

      // linear16 PCM at the context's native rate — Deepgram decodes it directly.
      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'es',
        punctuate: 'true',
        interim_results: 'true',
        diarize: 'true',
        encoding: 'linear16',
        sample_rate: String(Math.round(ctx.sampleRate)),
        channels: '1',
      })
      ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key])
      wsRef.current = ws
      const socket = ws

      const src = ctx.createMediaStreamSource(micStream)
      srcRef.current = src
      const sink = ctx.createGain()
      sink.gain.value = 0 // muted: keeps the graph pulling without echoing to speakers
      sinkRef.current = sink

      const sendPcm = (data: ArrayBuffer) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(data)
      }

      let node: AudioNode
      try {
        const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' })
        url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        await ctx.audioWorklet.addModule(url)
        if (aborted()) return cleanupLocal()
        const worklet = new AudioWorkletNode(ctx, 'pcm-capture')
        worklet.port.onmessage = (e) => sendPcm(e.data as ArrayBuffer)
        workletRef.current = worklet
        node = worklet
      } catch {
        // Fallback for browsers without AudioWorklet support.
        const sp = ctx.createScriptProcessor(4096, 1, 1)
        sp.onaudioprocess = (ev) => {
          if (socket.readyState !== WebSocket.OPEN) return
          const ch = ev.inputBuffer.getChannelData(0)
          const pcm = new Int16Array(ch.length)
          for (let i = 0; i < ch.length; i++) {
            const s = Math.max(-1, Math.min(1, ch[i]))
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          sendPcm(pcm.buffer)
        }
        scriptRef.current = sp
        node = sp
      }

      src.connect(node)
      node.connect(sink)
      sink.connect(ctx.destination)

      socket.onopen = () => {
        if (aborted()) {
          socket.close()
          return
        }
        flushTimerRef.current = setInterval(() => {
          void flushBuffer()
        }, FLUSH_INTERVAL_MS)
        setStatus('recording')
        setError(null)
      }

      socket.onmessage = (event) => {
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

      socket.onerror = (err) => {
        console.error('[deepgram] WebSocket error', err)
      }

      socket.onclose = () => {
        // Surface an unexpected drop (network / Deepgram), but stay quiet when
        // the socket closed because we (or a superseding start) stopped it.
        if (!aborted() && runningRef.current) {
          runningRef.current = false
          teardown() // release the mic + graph so "Enable microphone" reconnects cleanly
          setStatus('error')
          setError('Live transcription disconnected. Click Enable microphone to resume.')
          onErrorRef.current?.('Live transcription disconnected.')
        }
      }

      // End capture if the mic device itself is stopped (unplugged / revoked).
      micStream.getAudioTracks()[0].onended = () => {
        void stop()
      }
    } catch (err) {
      console.error('[mic-capture]', err)
      cleanupLocal()
      runningRef.current = false
      const message = micErrorMessage(err)
      setStatus('error')
      setError(message)
      onErrorRef.current?.(message)
    }
  }, [flushBuffer, meetingId, stop, teardown])

  return { active: status === 'recording', status, error, start, stop }
}
