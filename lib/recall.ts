const RECALL_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-central-1',
  'ap-northeast-1',
]

// Cached after first successful auth check
let _resolvedBase: string | null = process.env.RECALL_AI_REGION
  ? `https://${process.env.RECALL_AI_REGION}.recall.ai/api/v1`
  : null

function headers() {
  return {
    'Authorization': `Token ${process.env.RECALL_AI_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function getApiBase(): Promise<string> {
  if (_resolvedBase) return _resolvedBase

  for (const region of RECALL_REGIONS) {
    const base = `https://${region}.recall.ai/api/v1`
    const res = await fetch(`${base}/bot/?limit=1`, { headers: headers() })
    if (res.status !== 403 && res.status !== 401) {
      _resolvedBase = base
      console.log(`[recall] Using region: ${region}`)
      return base
    }
  }

  // Fallback — let the error surface naturally
  _resolvedBase = `https://us-east-1.recall.ai/api/v1`
  return _resolvedBase
}

export interface RecallBot {
  id: string
  status_changes: Array<{ code: string; created_at: string }>
  meeting_url: string
  // Platform-dependent and often absent — treat any title here as best-effort;
  // transcript extraction is the primary source for meeting titles.
  meeting_metadata?: { title?: string | null } | null
  recordings?: Array<{
    id: string
    status: { code: string }
    media_shortcuts: {
      transcript: { id: string; status: { code: string }; data: { download_url: string | null } } | null
    }
  }>
}

// Public base URL that Recall posts transcript webhooks to. On Vercel, always
// use the stable production domain so webhooks reach the live deployment even if
// NEXT_PUBLIC_APP_URL is stale (e.g. a leftover ngrok dev tunnel). Locally,
// VERCEL_PROJECT_PRODUCTION_URL is absent so dev falls back to NEXT_PUBLIC_APP_URL.
function publicBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? ''
}

export async function createBot(meetingUrl: string, meetingId: string): Promise<RecallBot> {
  const base = await getApiBase()
  const appUrl = publicBaseUrl()
  const webhookUrl = `${appUrl}/api/webhooks/recall`

  console.log(`[recall] createBot — APP_URL=${appUrl} webhook=${webhookUrl}`)

  const payload: Record<string, unknown> = {
    meeting_url: meetingUrl,
    bot_name: 'PropMaker',
    metadata: { meeting_id: meetingId },
    webhook_url: webhookUrl,
    recording_config: {
      transcript: {
        provider: {
          recallai_streaming: { language_code: 'auto', mode: 'prioritize_accuracy' },
        },
      },
      realtime_endpoints: [
        {
          type: 'webhook',
          url: webhookUrl,
          // partial_data = word-by-word interim (shown live); data = finalized
          // utterances (persisted as segments).
          events: ['transcript.data', 'transcript.partial_data'],
        },
      ],
    },
  }

  const res = await fetch(`${base}/bot/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Recall.ai error: ${err}`)
  }

  return res.json()
}

export async function getBot(botId: string): Promise<RecallBot> {
  const base = await getApiBase()
  const res = await fetch(`${base}/bot/${botId}/`, { headers: headers() })
  if (!res.ok) throw new Error(`Recall.ai bot fetch failed: ${await res.text()}`)
  return res.json()
}

export async function stopBot(botId: string): Promise<void> {
  const base = await getApiBase()
  await fetch(`${base}/bot/${botId}/leave_call/`, {
    method: 'POST',
    headers: headers(),
  })
}

export interface RecallTranscriptWord {
  text: string
  start_time: number
  end_time: number
  confidence: number
  is_final: boolean
}

export interface RecallTranscriptSegment {
  speaker: string | null
  words: RecallTranscriptWord[]
}

// Normalizes async transcript format → our internal RecallTranscriptSegment[]
// New format: [{ participant: { name }, words: [{ text, start_timestamp: { relative } }] }]
// Old format: [{ speaker, words: [{ text, start_time, ... }] }]
function normalizeTranscript(data: unknown): RecallTranscriptSegment[] {
  const arr: unknown[] = Array.isArray(data)
    ? data
    : ((data as any)?.results ?? (data as any)?.segments ?? [])

  if (arr.length === 0) return []

  if ((arr[0] as any)?.participant !== undefined) {
    return arr.map((seg: any) => ({
      speaker: seg.participant?.name ?? null,
      words: (seg.words ?? []).map((w: any) => ({
        text: w.text,
        start_time: w.start_timestamp?.relative ?? 0,
        end_time: w.end_timestamp?.relative ?? 0,
        confidence: 1,
        is_final: true,
      })),
    }))
  }

  return arr as RecallTranscriptSegment[]
}

export async function createTranscript(recordingId: string): Promise<void> {
  const base = await getApiBase()
  const res = await fetch(`${base}/recording/${recordingId}/create_transcript/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      provider: { deepgram_async: { language_code: 'auto' } },
      diarization: { use_separate_streams_when_available: true },
    }),
  })
  const body = await res.text()
  console.log(`[recall] create_transcript recording=${recordingId} status=${res.status} body=${body.slice(0, 300)}`)
}

export async function getTranscriptById(transcriptId: string): Promise<RecallTranscriptSegment[]> {
  const base = await getApiBase()
  const res = await fetch(`${base}/transcript/${transcriptId}/`, { headers: headers() })
  const raw = await res.text()
  console.log(`[recall] transcript retrieve status=${res.status} body=${raw.slice(0, 200)}`)
  if (!res.ok) return []

  const artifact = JSON.parse(raw)
  const downloadUrl: string | null = artifact?.data?.download_url ?? null
  if (!downloadUrl) return []

  const dlRes = await fetch(downloadUrl)
  const dlData = await dlRes.json()
  console.log(`[recall] transcript downloaded, ${Array.isArray(dlData) ? dlData.length : '?'} segments`)
  return normalizeTranscript(dlData)
}

export async function getBotTranscript(botId: string): Promise<RecallTranscriptSegment[]> {
  const base = await getApiBase()

  const botRes = await fetch(`${base}/bot/${botId}/`, { headers: headers() })
  if (!botRes.ok) {
    console.log(`[recall] bot fetch failed: ${botRes.status}`)
    return []
  }
  const bot: RecallBot = await botRes.json()

  for (const recording of (bot.recordings ?? [])) {
    if (recording.status?.code !== 'done') continue

    const artifact = recording.media_shortcuts?.transcript

    if (!artifact) {
      console.log(`[recall] no transcript artifact yet for recording ${recording.id} — still processing`)
      return []
    }

    console.log(`[recall] transcript artifact status=${artifact.status?.code} id=${artifact.id}`)

    if (artifact.status?.code !== 'done') return []

    const downloadUrl = artifact.data?.download_url
    if (!downloadUrl) return []

    const dlRes = await fetch(downloadUrl)
    const dlRaw = await dlRes.text()
    console.log(`[recall] transcript download body=${dlRaw.slice(0, 500)}`)
    const dlData = JSON.parse(dlRaw)
    console.log(`[recall] transcript downloaded, ${Array.isArray(dlData) ? dlData.length : '?'} segments`)
    return normalizeTranscript(dlData)
  }

  console.log(`[recall] no completed recording for bot ${botId}`)
  return []
}
