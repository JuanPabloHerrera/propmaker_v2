import Anthropic from '@anthropic-ai/sdk'
import {
  MeetingType,
  MEETING_TYPE_LABELS,
  PRICE_UNIT_LABELS,
  type DocType,
  type Product,
  type MeetingAttendee,
} from '@/types'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * True when an Anthropic error means the AI is temporarily unavailable rather
 * than a caller bug — the org hit its spend/usage limit (400 with a usage-limit
 * message), got rate limited (429), or the API is overloaded (529/500). Routes
 * should surface a 503 for these instead of a raw 500, and best-effort callers
 * (suggestions, extraction) should skip gracefully and allow a later retry.
 */
export function isAIUnavailableError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429 || err.status === 529 || err.status === 500) return true
    if (err.status === 400 && /usage limit/i.test(err.message ?? '')) return true
  }
  return false
}

// Soft cap to keep prompts bounded. Beyond this, the proposal agent gets a warning slice.
const MAX_CATALOG_ITEMS = 100

export async function generateSuggestions(
  transcript: string,
  meetingType: MeetingType
): Promise<string[]> {
  const label = MEETING_TYPE_LABELS[meetingType]

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 512,
    // Thinking disabled: Sonnet 5 runs adaptive thinking when `thinking` is
    // omitted, which would spend this call's small budget on reasoning and
    // truncate the JSON. This call is latency-critical and returns structured data.
    thinking: { type: 'disabled' },
    system: `You are a meeting coach helping a consultant run a ${label} discovery call.
Given the transcript so far, suggest the single sharpest follow-up question the consultant should ask next.
Return ONLY a JSON array with exactly one string. No markdown, no explanation. Example: ["Question?"]`,
    messages: [{ role: 'user', content: `Transcript so far:\n\n${transcript}` }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.slice(0, 1) : []
  } catch {
    return []
  }
}

function renderCatalog(products: Product[]): string {
  if (products.length === 0) {
    return '(No active products in the user catalog. Generate a proposal sourced from the conversation alone, and do not invent line items.)'
  }
  const slice = products.slice(0, MAX_CATALOG_ITEMS)
  const lines = slice.map((p, i) => {
    const price =
      p.price_amount != null
        ? `${p.currency} ${p.price_amount.toLocaleString()}${p.price_unit ? ` (${PRICE_UNIT_LABELS[p.price_unit]})` : ''}`
        : '(price not set)'
    const parts = [
      `${i + 1}. ${p.name} — category: ${p.category} — ${price}`,
      p.description ? `   Description: ${p.description}` : null,
      p.notes ? `   Internal notes: ${p.notes}` : null,
    ].filter(Boolean)
    return parts.join('\n')
  })
  const overflow =
    products.length > MAX_CATALOG_ITEMS
      ? `\n(… ${products.length - MAX_CATALOG_ITEMS} more products were truncated to keep the prompt bounded.)`
      : ''
  return lines.join('\n') + overflow
}

/**
 * Render the in-meeting AI-suggested questions as a labeled prompt block, or
 * null when there were none. These are AI-generated "Consider asking…" prompts
 * surfaced during the call — useful context for what mattered, but NOT things
 * the client confirmed, so they rank below the human sources.
 */
function renderAiSuggestions(aiSuggestions?: string[]): string | null {
  if (!aiSuggestions || aiSuggestions.length === 0) return null
  return `## IN-MEETING AI SUGGESTIONS (context — AI-generated prompts, not client-confirmed)\n${aiSuggestions
    .map((q) => `- ${q}`)
    .join('\n')}`
}

// ── Reference proposals ─────────────────────────────────────────────
// Past proposals the user uploaded / reused, summarized once at save time and
// fed to the proposal agent as cached context for "similar past projects".

export interface ReferenceSummaryInput {
  title: string
  summary: string
}

const MAX_REFERENCE_PROPOSALS = 8
const MAX_REFERENCE_SUMMARY_CHARS = 2400

const REFERENCE_SUMMARY_SYSTEM = `You are a proposal analyst. Read one of the user's PAST business proposals and produce a compact, structured summary that another proposal writer can learn from.
Capture, as short labeled lines: client / industry, project type, scope & key deliverables, pricing approach + ballpark total, timeline, and what made the proposal effective.
Be specific and concrete; skip boilerplate, legal text, and contact details. Return ONLY the summary (under 350 words), no preamble.`

async function runReferenceSummary(content: Anthropic.MessageParam['content']): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    system: REFERENCE_SUMMARY_SYSTEM,
    messages: [{ role: 'user', content }],
  })
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  return text.trim().slice(0, MAX_REFERENCE_SUMMARY_CHARS)
}

export function summarizeReferenceText(text: string): Promise<string> {
  const trimmed = text.trim().slice(0, 15000)
  if (!trimmed) return Promise.resolve('')
  return runReferenceSummary(`Proposal to summarize:\n\n${trimmed}`)
}

export function summarizeReferencePdf(pdfBase64: string): Promise<string> {
  return runReferenceSummary([
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
    { type: 'text', text: 'Summarize this proposal per the instructions.' },
  ])
}

/**
 * Transcribe a reference PDF to plain text so its full content can be stored
 * (reference_proposals.full_text) and injected when it's the matched reference.
 * Best-effort: returns '' on failure so upload still succeeds with summary-only.
 */
export async function extractReferencePdfText(pdfBase64: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 16384,
      // Thinking disabled: Sonnet 5 runs adaptive thinking when `thinking` is
      // omitted, which would spend this call's small budget on reasoning and
      // truncate the JSON. This call is latency-critical and returns structured data.
      thinking: { type: 'disabled' },
      system:
        'You transcribe business documents. Return the COMPLETE plain text of the attached PDF in reading order, preserving headings and tables as simple text lines. Skip page numbers, headers/footers, and decorative elements. Return only the transcription — no commentary, no code fences.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Transcribe this document to plain text.' },
          ],
        },
      ],
    })
    return msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
  } catch {
    return ''
  }
}

function renderReferenceProposals(refs: ReferenceSummaryInput[] | undefined): string {
  if (!refs || refs.length === 0) return ''
  const slice = refs.slice(0, MAX_REFERENCE_PROPOSALS)
  const blocks = slice.map((r, i) => `${i + 1}. ${r.title}\n${r.summary}`)
  const overflow =
    refs.length > MAX_REFERENCE_PROPOSALS
      ? `\n\n(… ${refs.length - MAX_REFERENCE_PROPOSALS} more references omitted to keep the prompt bounded.)`
      : ''
  return blocks.join('\n\n') + overflow
}

// Appended to the proposal-writing instructions when references are present.
const REFERENCE_RULE = `Reference proposals:
- You may be given REFERENCE PROPOSALS from the user's past projects. Use them ONLY as models for structure, section flow, tone, scope framing, and pricing APPROACH on similar projects.
- You MUST NOT copy or introduce any line item, product, service, or price from a reference that is not in the user's current catalog — line items remain governed by the catalog rule above.`

function referenceSystemBlock(
  referenceProposals: ReferenceSummaryInput[] | undefined,
): Anthropic.TextBlockParam | null {
  const referencesBlock = renderReferenceProposals(referenceProposals)
  if (!referencesBlock) return null
  return {
    type: 'text',
    text: `## REFERENCE PROPOSALS (past similar projects — structure/approach only)\n${referencesBlock}`,
    cache_control: { type: 'ephemeral' },
  }
}

function buildSystemBlocks(
  instructions: string,
  catalogBlock: string,
  referenceProposals: ReferenceSummaryInput[] | undefined,
): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: instructions, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `## USER PRODUCT CATALOG\n${catalogBlock}`, cache_control: { type: 'ephemeral' } },
  ]
  const refBlock = referenceSystemBlock(referenceProposals)
  if (refBlock) blocks.push(refBlock)
  return blocks
}

/** Parse a JSON object out of a model reply, tolerating code fences and prose. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
      } catch {
        return null
      }
    }
    return null
  }
}

// ── Post-meeting metadata extraction ────────────────────────────────
// The pre-meeting form is gone: the meeting's title, client company, attendees,
// context summary, and dominant language are detected from the transcript once
// the meeting ends. Never throws — on failure every field comes back null/empty
// so callers can skip the update.

export interface ExtractedMeetingMetadata {
  title: string | null
  client_company: string | null
  attendees: MeetingAttendee[]
  context_summary: string | null
  /** Dominant transcript language as a lowercase ISO 639-1 code (e.g. "es"). */
  language: string | null
}

interface ExtractMetadataInput {
  browserTranscript: string
  recallTranscript: string
  notesText: string
}

export async function extractMeetingMetadata({
  browserTranscript,
  recallTranscript,
  notesText,
}: ExtractMetadataInput): Promise<ExtractedMeetingMetadata> {
  const empty: ExtractedMeetingMetadata = {
    title: null,
    client_company: null,
    attendees: [],
    context_summary: null,
    language: null,
  }
  const transcript = browserTranscript || recallTranscript
  if (!transcript.trim()) return empty

  const userContent = [
    `## PRIMARY TRANSCRIPT\n${transcript.slice(0, 30000)}`,
    notesText ? `## CONSULTANT NOTES\n${notesText.slice(0, 4000)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      // Thinking disabled: Sonnet 5 runs adaptive thinking when `thinking` is
      // omitted, which would spend this call's small budget on reasoning and
      // truncate the JSON. This call is latency-critical and returns structured data.
      thinking: { type: 'disabled' },
      system: `You label business-meeting transcripts. Extract metadata from the meeting below.

Return ONLY a JSON object (no markdown, no prose) with exactly these keys:
{
  "title": string,            // short client-facing meeting title in the transcript's language, e.g. "Descubrimiento — CRM Acme"
  "client_company": string|null, // the CLIENT organization discussed, null if unclear
  "attendees": [{ "name": string }], // people who spoke or were named as present (≤8)
  "context_summary": string,  // 2–3 sentences: who met, what the client needs, key constraints
  "language": string          // dominant spoken language as a lowercase ISO 639-1 code, e.g. "es"
}

Ground everything in the transcript; use null/[] when a field is genuinely unclear. Never invent names.`,
      messages: [{ role: 'user', content: userContent }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const o = parseJsonObject(text)
    if (!o) return empty
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const attendees = Array.isArray(o.attendees)
      ? o.attendees
          .map((a): MeetingAttendee | null => {
            if (!a || typeof a !== 'object') return null
            const name = str((a as Record<string, unknown>).name)
            return name ? { name } : null
          })
          .filter((a): a is MeetingAttendee => a !== null)
          .slice(0, 8)
      : []
    const language = str(o.language)?.toLowerCase().slice(0, 5) ?? null
    return {
      title: str(o.title),
      client_company: str(o.client_company),
      attendees,
      context_summary: str(o.context_summary),
      language,
    }
  } catch (err) {
    // AI-unavailable (spend cap / rate limit / overload) must propagate so the
    // caller can release its extraction guard and retry later — returning empty
    // here would let the idempotency claim mark the meeting permanently blank.
    if (isAIUnavailableError(err)) throw err
    return empty
  }
}

// ── Reference matching ──────────────────────────────────────────────
// Before a proposal is written, pick the single MOST SIMILAR past reference
// proposal. Its full text (stored at upload) is then injected into the proposal
// prompt so scope structure, timelines, and service packaging mirror a real,
// comparable project — while unit prices stay governed by the live catalog.

export interface ReferenceMatchCandidate {
  id: string
  title: string
  summary: string
}

export async function matchReferenceProposal({
  meetingDigest,
  refs,
}: {
  meetingDigest: string
  refs: ReferenceMatchCandidate[]
}): Promise<{ refId: string | null; reason: string | null }> {
  if (refs.length === 0) return { refId: null, reason: null }

  const list = refs
    .map((r, i) => `${i + 1}. id: ${r.id}\n   title: ${r.title}\n   ${r.summary.slice(0, 1600)}`)
    .join('\n\n')

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 512,
      // Thinking disabled: Sonnet 5 runs adaptive thinking when `thinking` is
      // omitted, which would spend this call's small budget on reasoning and
      // truncate the JSON. This call is latency-critical and returns structured data.
      thinking: { type: 'disabled' },
      system: `You match a new client engagement against a library of the user's PAST proposals to find the single most similar past project (by industry, project type, scope, and deal shape).

Return ONLY a JSON object: { "refId": string|null, "reason": string }
- "refId" MUST be one of the candidate ids verbatim, or null if none is a reasonable match.
- "reason": one sentence on why it is (or nothing is) the best match.`,
      messages: [
        {
          role: 'user',
          content: `## NEW ENGAGEMENT\n${meetingDigest.slice(0, 12000)}\n\n## PAST PROPOSAL CANDIDATES\n${list}`,
        },
      ],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const o = parseJsonObject(text)
    const refId = typeof o?.refId === 'string' ? o.refId : null
    const valid = refId && refs.some((r) => r.id === refId) ? refId : null
    return { refId: valid, reason: typeof o?.reason === 'string' ? o.reason : null }
  } catch {
    return { refId: null, reason: null }
  }
}

/**
 * User-content line that sets the output language. Lives in the per-call user
 * content, NOT in the cached system blocks — keep those byte-stable.
 */
function languageDirective(language: string | null): string {
  const lang = language?.trim() || 'es'
  return `## OUTPUT LANGUAGE\nWrite the ENTIRE document in the language with ISO 639-1 code "${lang}" (the meeting's dominant language).`
}

// ── Meeting minute & transcript summary ─────────────────────────────
// Two of the three post-meeting document types. Both are generated in one pass
// from the transcript (+ notes; the minute also folds in the live co-pilot
// artifacts) and return Markdown for markdownToTiptap.

interface MeetingMinuteInput {
  browserTranscript: string
  recallTranscript: string
  notesText: string
  liveChatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  aiSuggestions?: string[]
  attendees: MeetingAttendee[]
  clientCompany: string | null
  language: string | null
}

const MINUTE_INSTRUCTIONS = `You write formal MEETING MINUTES from a business meeting's transcript and supporting artifacts.

Source priority (highest to lowest authority):
1. Consultant's notes — authoritative.
2. Browser transcript (primary audio) — higher fidelity.
3. Recall.ai transcript (fallback audio) — fills gaps only.
4. In-meeting co-pilot conversation and AI suggestions — the consultant's working hypotheses, NOT client decisions.

Writing style: direct and concrete; every line carries a specific fact from the sources — a name, decision, number, date, or commitment. No filler, no corporate register, no invented detail. If the sources don't cover a section, omit the section.

Output structure — Markdown, use exactly these ## headers (translated into the output language), omitting any section the meeting didn't cover:
## Attendees
Bulleted names (and roles/companies when stated).
## Topics Discussed
Bulleted; one bullet per topic, with the substance of what was said.
## Decisions
Bulleted; only decisions actually agreed in the meeting.
## Action Items
Bulleted; each item as **owner** — task, with the deadline when one was stated.
## Open Questions
Bulleted; unresolved items that need follow-up.

Return only the Markdown content — no preamble, no commentary, and no top-level title (the app supplies the document title).`

export async function generateMeetingMinute({
  browserTranscript,
  recallTranscript,
  notesText,
  liveChatHistory,
  aiSuggestions,
  attendees,
  clientCompany,
  language,
}: MeetingMinuteInput): Promise<string> {
  const liveContext = liveChatHistory
    .map((m) => `${m.role === 'assistant' ? 'Co-pilot' : 'Consultant'}: ${m.content}`)
    .join('\n\n')

  const attendeeLine = attendees.length
    ? attendees.map((a) => (a.email ? `${a.name} <${a.email}>` : a.name)).join(', ')
    : '(none recorded)'

  const userContent = [
    languageDirective(language),
    `## MEETING CONTEXT\nClient — ${clientCompany || '(unknown)'}\nKnown attendees — ${attendeeLine}`,
    `## CONSULTANT NOTES (authoritative)\n${notesText || '(none)'}`,
    `## PRIMARY TRANSCRIPT (browser audio)\n${browserTranscript || '(none)'}`,
    recallTranscript ? `## FALLBACK TRANSCRIPT (Recall.ai)\n${recallTranscript}` : null,
    liveContext ? `## IN-MEETING CO-PILOT CONVERSATION\n${liveContext}` : null,
    renderAiSuggestions(aiSuggestions),
  ]
    .filter(Boolean)
    .join('\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8192,
    system: [{ type: 'text', text: MINUTE_INSTRUCTIONS, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })

  return msg.content[0]?.type === 'text' ? msg.content[0].text : ''
}

interface TranscriptSummaryInput {
  browserTranscript: string
  recallTranscript: string
  notesText: string
  language: string | null
}

const SUMMARY_INSTRUCTIONS = `You write a concise NARRATIVE SUMMARY of a business meeting from its transcript.

Your job: let someone who missed the meeting understand in two minutes what happened — who met, what the client needs, what was discussed, and where things landed.

Writing style: direct and concrete; short paragraphs and tight bullets; every sentence carries a specific fact from the transcript. No filler, no invented detail, say each thing once.

Output structure — Markdown, use exactly these ## headers (translated into the output language):
## Overview
2–4 sentences: who met, why, and the single most important outcome.
## Key Points
Bulleted; the substance of the conversation, in the order it mattered (not chronological small talk).
## Next Steps
Bulleted; what happens after this meeting, with owners/dates when stated. Omit if none were discussed.

Return only the Markdown content — no preamble, no commentary, and no top-level title (the app supplies the document title).`

export async function generateTranscriptSummary({
  browserTranscript,
  recallTranscript,
  notesText,
  language,
}: TranscriptSummaryInput): Promise<string> {
  const userContent = [
    languageDirective(language),
    `## CONSULTANT NOTES (authoritative)\n${notesText || '(none)'}`,
    `## PRIMARY TRANSCRIPT (browser audio)\n${browserTranscript || '(none)'}`,
    recallTranscript ? `## FALLBACK TRANSCRIPT (Recall.ai)\n${recallTranscript}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 6144,
    system: [{ type: 'text', text: SUMMARY_INSTRUCTIONS, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })

  return msg.content[0]?.type === 'text' ? msg.content[0].text : ''
}

interface NotesDocumentInput {
  notesText: string
  attendees: MeetingAttendee[]
  clientCompany: string | null
  language: string | null
}

const NOTES_DOC_INSTRUCTIONS = `You turn a consultant's raw in-meeting notes into a clean, shareable NOTES DOCUMENT.

Your ONLY source is the consultant's own notes. There is no transcript here and you must not invent one: never add facts, numbers, names, decisions, or commitments that are not in the notes. This document is the consultant's voice, tidied — not a meeting reconstruction.

Your job:
- Preserve every point the consultant wrote — nothing gets dropped, however terse.
- Fix typos, expand obvious shorthand into full sentences, and normalize punctuation, without changing meaning.
- Organize: group related points under ## headings that mirror the notes' own structure and topics (keep the consultant's headings when they wrote any). Use bullets for enumerations, short paragraphs for prose.
- Keep it lean: no summaries of the notes, no commentary, no boilerplate sections.

Output: Markdown only — no preamble and no top-level title (the app supplies the document title).`

export async function generateNotesDocument({
  notesText,
  attendees,
  clientCompany,
  language,
}: NotesDocumentInput): Promise<string> {
  const attendeeLine = attendees.length
    ? attendees.map((a) => (a.email ? `${a.name} <${a.email}>` : a.name)).join(', ')
    : '(none recorded)'

  const userContent = [
    languageDirective(language),
    `## MEETING CONTEXT (for orientation only — do not add facts from it)\nClient — ${clientCompany || '(unknown)'}\nKnown attendees — ${attendeeLine}`,
    `## CONSULTANT NOTES (the only source)\n${notesText}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 6144,
    system: [{ type: 'text', text: NOTES_DOC_INSTRUCTIONS, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })

  return msg.content[0]?.type === 'text' ? msg.content[0].text : ''
}

export interface MatchedReferenceInput {
  title: string
  summary: string
  full_text?: string | null
}

const MAX_MATCHED_REFERENCE_CHARS = 20000

/** The matched past proposal, rendered for the per-call user content (never cached). */
function renderMatchedReference(ref: MatchedReferenceInput | null | undefined): string | null {
  if (!ref) return null
  const body = ref.full_text?.trim()
    ? ref.full_text.trim().slice(0, MAX_MATCHED_REFERENCE_CHARS)
    : ref.summary
  return `## MATCHED PAST PROPOSAL — "${ref.title}" (most similar past project)\nMirror this proposal's scope structure, section flow, timeline estimates, and how services are packaged and quantified — adapted to what THIS client asked for. Unit prices still come ONLY from the live catalog, never from here.\n\n${body}`
}

interface GenerateProposalInput {
  browserTranscript: string
  recallTranscript: string
  notesText: string
  products: Product[]
  liveChatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  aiSuggestions?: string[]
  meetingType: MeetingType
  contextSummary: string | null
  clientCompany: string | null
  matchedReference?: MatchedReferenceInput | null
  language: string | null
}

export async function generateProposal({
  browserTranscript,
  recallTranscript,
  notesText,
  products,
  liveChatHistory,
  aiSuggestions,
  meetingType,
  contextSummary,
  clientCompany,
  matchedReference,
  language,
}: GenerateProposalInput): Promise<string> {
  const label = MEETING_TYPE_LABELS[meetingType]

  const liveContext = liveChatHistory
    .map((m) => `${m.role === 'assistant' ? 'Co-pilot' : 'Consultant'}: ${m.content}`)
    .join('\n\n')

  const catalogBlock = renderCatalog(products)

  const instructions = `You are a proposal writer for ${label} projects. You write CLEAN, DIRECT proposals in Markdown — the kind a busy decision-maker skims in under a minute — in ONE pass from the meeting sources: the product catalog, consultant notes, the primary browser transcript, the fallback Recall.ai transcript, and the in-meeting co-pilot conversation. A MATCHED PAST PROPOSAL may also be provided — the user's most similar past project.

Source priority (highest to lowest authority):
1. Consultant's notes — authoritative; reflects the consultant's own intent and observations.
2. Browser transcript (primary audio) — higher fidelity; trust this over the fallback when they disagree.
3. Recall.ai transcript (fallback audio) — use only to fill gaps in the primary transcript.
4. In-meeting co-pilot conversation — the consultant's working hypotheses with the AI during the call, NOT decisions agreed with the client.
5. In-meeting AI suggestions — AI-generated "consider asking" prompts; use only as hints about what mattered, never as client-confirmed facts.

Matched past proposal rule (when provided):
- It is the user's most similar PAST project. Mirror its scope structure, section flow, timeline estimates, and how services are packaged/quantified — adapted to what THIS client asked for in the transcript.
- Its prices are HISTORY: unit prices come ONLY from the live catalog. Never copy a price, line item, or product from the matched proposal that is not in the current catalog.

Writing style (STRICT — this is the point):
- Direct and concrete. Every sentence must carry a specific fact from the sources — a name, number, date, deliverable, or decision. If a sentence would fit any proposal, delete it.
- No preamble, no throat-clearing. Never open a section with "This proposal outlines…", "We are pleased to…", "In today's…", or "The goal is to…". Start with substance.
- Ban filler and empty assurances: "efficiently and effectively", "seamless", "robust", "world-class", "cutting-edge", "leverage synergies", "work collaboratively to ensure alignment", "ensure expectations are met". Cut any sentence that only reassures.
- Bullet-forward: prefer tight bullets over paragraphs. Short sentences, active voice, plain language over corporate register.
- Say each thing ONCE. Do not repeat the budget, timeline, point of contact, or scope across multiple sections.
- No closing pitch, thank-you, or "we look forward to…" — the signature handles sign-off.
- Never invent detail to fill space. If the sources don't cover a section, write one honest line instead of padding (or omit the section where the rules below allow).

Catalog rule:
- The user's catalog is the ONLY set of offerings you may propose. Do not invent line items, services, or products that are not in the catalog.
- If the catalog is empty, write the proposal without a line-items table.

Output structure — use exactly these ## headers (translated into the output language), and keep each section as short as the content honestly allows:
## Executive Summary
2–3 sentences: what you will deliver, for whom, and the single most important constraint (budget or deadline). Do not restate it later.
## Priorities & Key Deliverables
A bulleted list ("-"), highest priority first. Each item: the deliverable in **bold**, then " — " and ONE sentence. Derive the priorities from what the client emphasized in the sources.
## Scope of Work
Bulleted. Each bullet is one concrete piece of work in **bold** plus a short clause. Add an "Out of scope:" bullet group ONLY if the sources named exclusions.
## Timeline & Milestones
A Markdown table (columns: Phase, Milestone, Deliverable) when the sources support phases/dates; otherwise a short bulleted list. Use the matched past proposal's timeline shape as the model when one is provided. Omit the section if timing is unknown.
## Recommended Line Items
A Markdown table with columns: Item, Category, Description, Unit price. Reference only catalog products by their exact name. Omit this section entirely if the catalog is empty.
## Budget & Pricing
The pricing that follows from the line items plus any stated caps — a short table or ≤2 sentences. Don't re-describe items already in the table above.

Return only the Markdown content — no preamble, no commentary.`

  const userContent = [
    languageDirective(language),
    `## MEETING CONTEXT\nClient — ${clientCompany || '(unknown)'}\nContext — ${contextSummary || '(none)'}`,
    renderMatchedReference(matchedReference),
    `## CONSULTANT NOTES (authoritative)\n${notesText || '(none)'}`,
    `## PRIMARY TRANSCRIPT (browser audio)\n${browserTranscript || '(none)'}`,
    recallTranscript ? `## FALLBACK TRANSCRIPT (Recall.ai)\n${recallTranscript}` : null,
    liveContext ? `## IN-MEETING CO-PILOT CONVERSATION\n${liveContext}` : null,
    renderAiSuggestions(aiSuggestions),
  ]
    .filter(Boolean)
    .join('\n\n')

  // The matched reference supersedes the old cached "all references" system
  // block for proposal generation — instructions + catalog stay cached.
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 12288,
    system: buildSystemBlocks(instructions, catalogBlock, undefined),
    messages: [{ role: 'user', content: userContent }],
  })

  return msg.content[0].type === 'text' ? msg.content[0].text : ''
}

export function streamLiveChat(
  transcript: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  meetingType: MeetingType
) {
  return anthropic.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 512,
    // Thinking disabled: Sonnet 5 runs adaptive thinking when `thinking` is
    // omitted, which would spend this call's small budget on reasoning and
    // truncate the JSON. This call is latency-critical and returns structured data.
    thinking: { type: 'disabled' },
    system: `You are a real-time meeting assistant helping a consultant during a live ${MEETING_TYPE_LABELS[meetingType]} meeting.
The live transcript is attached below. Your role:
- Answer the consultant's questions about what's been discussed
- Suggest follow-up questions or actions the consultant should take right now
- Flag important decisions, risks, or action items mentioned
- Be concise — 2–4 sentences max unless the consultant asks for more

LIVE TRANSCRIPT:
${transcript}`,
    messages: chatHistory.map((m) => ({ role: m.role, content: m.content })),
  })
}

// ── Document refine ─────────────────────────────────────────────────
// Two-mode streaming for the refine drawer on any document page (minute,
// summary, or proposal). `mode: 'chat'` returns conversational suggestions
// (Claude explains what it would change and asks for confirmation).
// `mode: 'apply'` returns the FULL rewritten document markdown that the client
// then hydrates into the Tiptap editor.

export type RefineMode = 'chat' | 'apply'

const DOC_TYPE_NOUNS: Record<DocType, string> = {
  minute: 'meeting minutes document',
  summary: 'meeting transcript summary',
  proposal: 'project proposal',
  notes: 'meeting notes document (polished from the consultant\'s own notes)',
}

const DOC_TYPE_SECTIONS: Record<DocType, string> = {
  minute:
    '## Attendees, ## Topics Discussed, ## Decisions, ## Action Items, ## Open Questions',
  summary: '## Overview, ## Key Points, ## Next Steps',
  notes:
    'free-form ## headings that mirror the structure and topics of the consultant\'s own notes',
  proposal:
    '## Executive Summary, ## Priorities & Key Deliverables, ## Scope of Work, ## Timeline & Milestones, ## Recommended Line Items, ## Budget & Pricing',
}

interface RefineInput {
  mode: RefineMode
  docType: DocType
  currentMarkdown: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  products: Product[]
  meetingType: MeetingType
  referenceProposals?: ReferenceSummaryInput[]
}

export function streamDocumentRefine({
  mode,
  docType,
  currentMarkdown,
  history,
  products,
  meetingType,
  referenceProposals,
}: RefineInput) {
  const label = MEETING_TYPE_LABELS[meetingType]
  const noun = DOC_TYPE_NOUNS[docType]
  const isProposal = docType === 'proposal'
  const catalogBlock = renderCatalog(products)

  const catalogRules = `Catalog rule:
- The user's catalog is the ONLY set of offerings you may propose. Do not invent line items, services, or products that are not in the catalog.
- If the catalog is empty, prefer narrative changes over inventing pricing.

${REFERENCE_RULE}
`

  const sharedRules = `${isProposal ? catalogRules : ''}
Writing style (preserve it): direct and concrete, bullet-forward, no preamble or filler, no empty assurances ("efficiently and effectively", "seamless", "world-class", "ensure alignment"), no closing pitch. Every sentence carries a specific fact; say each thing once. Don't reintroduce padding the document already avoids.

Keep the document's existing language — do not translate it unless explicitly asked.`

  const chatInstructions = `You are revising an existing ${noun} for a ${label} engagement, working with the consultant in a back-and-forth refinement chat.

${sharedRules}

Your behavior in this turn:
- Read the consultant's request and the CURRENT DOCUMENT below.
- Reply conversationally (3-6 sentences). Be specific about what you would change and where (which section, which line, which sentence).
- Ask one clarifying question if the request is ambiguous.
- DO NOT rewrite the document here. The consultant will click "Apply changes" when ready, which triggers a separate rewrite pass.`

  const applyInstructions = `You are revising an existing ${noun} for a ${label} engagement.

${sharedRules}

Your behavior in this turn:
- Apply the consultant's accumulated requests from the chat to the CURRENT DOCUMENT.
- Return ONLY the FULL revised document in Markdown — no preamble, no chat, no code fences around the whole thing.
- Preserve all unchanged content verbatim. Only change what the chat asked you to change.
- Keep the section structure (${DOC_TYPE_SECTIONS[docType]}) unless the chat explicitly removed a section.`

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  if (mode === 'apply' && messages.length === 0) {
    messages.push({ role: 'user', content: 'Apply the changes we discussed.' })
  }

  const contextBlock = [
    isProposal ? `## USER PRODUCT CATALOG\n${catalogBlock}` : null,
    `## CURRENT DOCUMENT (Markdown)\n${currentMarkdown || '(empty)'}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const refineSystem: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: mode === 'apply' ? applyInstructions : chatInstructions,
      cache_control: { type: 'ephemeral' },
    },
    { type: 'text', text: contextBlock, cache_control: { type: 'ephemeral' } },
  ]
  const refineRefBlock = isProposal ? referenceSystemBlock(referenceProposals) : null
  if (refineRefBlock) refineSystem.push(refineRefBlock)

  return anthropic.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: mode === 'apply' ? 12288 : 2048,
    system: refineSystem,
    messages,
  })
}
