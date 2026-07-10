import { tiptapToText } from '@/lib/tiptap'
import type { createClient } from '@/lib/supabase/server'
import type {
  Meeting,
  MeetingAttendee,
  MeetingType,
  Product,
  TranscriptSegment,
} from '@/types'
import type { ReferenceSummaryInput } from '@/lib/claude'

type ServerClient = Awaited<ReturnType<typeof createClient>>

type ChatTurn = { role: 'user' | 'assistant'; content: string }

/**
 * Everything the post-meeting agents (Q&A, brief synthesis, proposal
 * generation) read from Supabase for one meeting. Centralized here so the
 * `/proposal/chat`, `/brief`, and `/proposal/generate` routes gather inputs
 * identically — the catalog union logic in particular is easy to drift.
 */
export interface MeetingInputs {
  meetingType: MeetingType
  browserTranscript: string
  recallTranscript: string
  notesText: string
  products: Product[]
  referenceProposals: ReferenceSummaryInput[]
  chatHistory: ChatTurn[]
  liveChatHistory: ChatTurn[]
  // In-meeting AI-suggested questions (the "Consider asking…" prompts), deduped
  // across every suggestions pass generated during the call.
  aiSuggestions: string[]
  // Pre-meeting metadata — previously dropped from generation; the brief uses it.
  contextSummary: string | null
  attendees: MeetingAttendee[]
  clientCompany: string | null
  clientValue: number | null
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
    .select(
      'meeting_type, notes_json, selected_categories, attached_product_ids, detected_product_ids, context_summary, attendees, client_company, client_value',
    )
    .eq('id', meetingId)
    .eq('user_id', userId)
    .single()

  if (!meeting) return null

  const m = meeting as Pick<
    Meeting,
    | 'meeting_type'
    | 'notes_json'
    | 'selected_categories'
    | 'attached_product_ids'
    | 'detected_product_ids'
    | 'context_summary'
    | 'attendees'
    | 'client_company'
    | 'client_value'
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

  // Catalog: union of (products in selected categories) ∪ (explicitly attached)
  // ∪ (auto-detected from transcript). selected_categories is a filter; attached
  // + detected are explicit IDs that always make it in even if their category
  // was unchecked. (Kept identical to the /proposal/chat route's logic.)
  const selected = m.selected_categories ?? []
  const explicitIds = Array.from(
    new Set([...(m.attached_product_ids ?? []), ...(m.detected_product_ids ?? [])]),
  )

  let productsQuery = supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
  if (selected.length > 0 && explicitIds.length > 0) {
    productsQuery = productsQuery.or(
      `category.in.(${selected.map((c) => `"${c}"`).join(',')}),id.in.(${explicitIds.join(',')})`,
    )
  } else if (selected.length > 0) {
    productsQuery = productsQuery.in('category', selected)
  }
  // When neither filter is set, load the full active catalog.
  const { data: productsData } = await productsQuery
  const products = (productsData ?? []) as Product[]

  // Reference proposals — the user's past projects (summaries) as structure/tone
  // context. Style-only decks (pptx_template) carry no useful text; keep them out.
  const { data: refData } = await supabase
    .from('reference_proposals')
    .select('title, summary')
    .eq('user_id', userId)
    .in('source', ['uploaded', 'app_proposal'])
    .order('created_at', { ascending: false })
    .limit(8)
  const referenceProposals = (refData ?? []) as ReferenceSummaryInput[]

  const { data: existingChat } = await supabase
    .from('post_meeting_chat')
    .select('role, content')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })
  const chatHistory = (existingChat ?? []) as ChatTurn[]

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
    chatHistory,
    liveChatHistory,
    aiSuggestions,
    contextSummary: m.context_summary ?? null,
    attendees: (m.attendees as MeetingAttendee[] | null) ?? [],
    clientCompany: m.client_company ?? null,
    clientValue: m.client_value ?? null,
  }
}
