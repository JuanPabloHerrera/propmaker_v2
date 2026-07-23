import { tiptapToText } from '@/lib/tiptap'
import type { createClient } from '@/lib/supabase/server'
import type {
  Meeting,
  MeetingAttendee,
  MeetingType,
  Product,
  TranscriptSegment,
} from '@/types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

type ChatTurn = { role: 'user' | 'assistant'; content: string }

/** A reference proposal as loaded for generation: match on summary, inject full_text. */
export interface ReferenceInput {
  id: string
  title: string
  summary: string
  full_text: string | null
}

/**
 * Everything the document generators (minute, summary, proposal) read from
 * Supabase for one meeting. Centralized here so every generation route gathers
 * inputs identically.
 */
export interface MeetingInputs {
  meetingType: MeetingType
  browserTranscript: string
  recallTranscript: string
  notesText: string
  products: Product[]
  referenceProposals: ReferenceInput[]
  liveChatHistory: ChatTurn[]
  // In-meeting AI-suggested questions (the "Consider asking…" prompts), deduped
  // across every suggestions pass generated during the call.
  aiSuggestions: string[]
  // Auto-extracted post-meeting metadata (editable on the documents hub).
  contextSummary: string | null
  attendees: MeetingAttendee[]
  clientCompany: string | null
  language: string | null
}

/**
 * Load and shape every generation input for a meeting. Returns null when the
 * meeting doesn't exist or isn't owned by the user (callers should 404).
 */
export async function gatherMeetingInputs(
  supabase: ServerClient,
  meetingId: string,
  userId: string,
): Promise<MeetingInputs | null> {
  const { data: meeting } = await supabase
    .from('meetings')
    .select('meeting_type, notes_json, context_summary, attendees, client_company, language')
    .eq('id', meetingId)
    .eq('user_id', userId)
    .single()

  if (!meeting) return null

  const m = meeting as Pick<
    Meeting,
    'meeting_type' | 'notes_json' | 'context_summary' | 'attendees' | 'client_company' | 'language'
  >

  // Partitioned transcripts (browser = primary, recall = fallback)
  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('speaker, text, source')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })

  const rows = (segments as Pick<TranscriptSegment, 'speaker' | 'text' | 'source'>[] | null) ?? []
  const formatSeg = (s: { speaker: string | null; text: string }) =>
    `${s.speaker ?? 'Speaker'}: ${s.text}`
  const browserTranscript = rows.filter((s) => s.source === 'browser').map(formatSeg).join('\n')
  const recallTranscript = rows.filter((s) => s.source === 'recall').map(formatSeg).join('\n')

  const notesText = tiptapToText(m.notes_json)

  // Catalog: with the pre-meeting form gone there are no category/attachment
  // filters — the full active catalog is always in play.
  const { data: productsData } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
  const products = (productsData ?? []) as Product[]

  // Reference proposals — the user's past projects. Summaries drive similarity
  // matching; full_text (stored at upload, null for legacy uploads) is injected
  // for the matched one. Style-only decks (pptx_template) carry no useful text.
  const { data: refData } = await supabase
    .from('reference_proposals')
    .select('id, title, summary, full_text')
    .eq('user_id', userId)
    .in('source', ['uploaded', 'app_proposal'])
    .order('created_at', { ascending: false })
    .limit(8)
  const referenceProposals = (refData ?? []) as ReferenceInput[]

  const { data: liveChat } = await supabase
    .from('live_meeting_chat')
    .select('role, content')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })
  const liveChatHistory = (liveChat ?? []) as ChatTurn[]

  // In-meeting AI suggestions — every "Consider asking…" question generated as
  // the transcript grew. Flatten across passes and dedupe (later passes repeat
  // earlier questions), preserving first-seen order.
  const { data: suggestionRows } = await supabase
    .from('suggestions')
    .select('questions')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })
  const seenSuggestions = new Set<string>()
  const aiSuggestions: string[] = []
  for (const row of (suggestionRows ?? []) as { questions: unknown }[]) {
    const questions = Array.isArray(row.questions) ? (row.questions as unknown[]) : []
    for (const q of questions) {
      const text = typeof q === 'string' ? q.trim() : ''
      if (text && !seenSuggestions.has(text)) {
        seenSuggestions.add(text)
        aiSuggestions.push(text)
      }
    }
  }

  return {
    meetingType: m.meeting_type as MeetingType,
    browserTranscript,
    recallTranscript,
    notesText,
    products,
    referenceProposals,
    liveChatHistory,
    aiSuggestions,
    contextSummary: m.context_summary ?? null,
    attendees: (m.attendees as MeetingAttendee[] | null) ?? [],
    clientCompany: m.client_company ?? null,
    language: m.language ?? null,
  }
}
