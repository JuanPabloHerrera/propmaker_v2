import Anthropic from '@anthropic-ai/sdk'
import { MeetingType, MEETING_TYPE_LABELS, PRICE_UNIT_LABELS, type Product } from '@/types'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Soft cap to keep prompts bounded. Beyond this, the proposal agent gets a warning slice.
const MAX_CATALOG_ITEMS = 100

export async function generateSuggestions(
  transcript: string,
  meetingType: MeetingType
): Promise<string[]> {
  const label = MEETING_TYPE_LABELS[meetingType]

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
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
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
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

interface GenerateProposalInput {
  browserTranscript: string
  recallTranscript: string
  notesText: string
  products: Product[]
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  liveChatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  meetingType: MeetingType
  referenceProposals?: ReferenceSummaryInput[]
}

export async function generateProposal({
  browserTranscript,
  recallTranscript,
  notesText,
  products,
  chatHistory,
  liveChatHistory,
  meetingType,
  referenceProposals,
}: GenerateProposalInput): Promise<string> {
  const label = MEETING_TYPE_LABELS[meetingType]

  const qaContext = chatHistory
    .map((m) => `${m.role === 'assistant' ? 'Claude' : 'Consultant'}: ${m.content}`)
    .join('\n\n')

  const liveContext = liveChatHistory
    .map((m) => `${m.role === 'assistant' ? 'Co-pilot' : 'Consultant'}: ${m.content}`)
    .join('\n\n')

  const catalogBlock = renderCatalog(products)

  const instructions = `You are a professional proposal writer specializing in ${label} projects.
You generate a complete, structured project proposal in Markdown based on six inputs: the user's product catalog, the consultant's notes, the primary browser transcript, the fallback Recall.ai transcript, the in-meeting co-pilot conversation, and the post-meeting Q&A.

Source priority (highest to lowest authority):
1. Consultant's notes — authoritative; reflects the consultant's own intent and observations.
2. Post-meeting Q&A — authoritative; resolves ambiguity in the transcripts.
3. Browser transcript (primary audio) — higher fidelity; trust this over the fallback when they disagree.
4. Recall.ai transcript (fallback audio) — use only to fill gaps in the primary transcript.
5. In-meeting co-pilot conversation — the consultant's working hypotheses with the AI during the call, NOT decisions agreed with the client.

Catalog rule:
- The user's catalog is the ONLY set of offerings you may propose. Do not invent line items, services, or products that are not in the catalog.
- If the catalog is empty, write the proposal narratively without a line-items table.

Output structure (use exactly these section headers with ## prefix):
## Executive Summary
## Scope of Work
## Timeline & Milestones
## Recommended Line Items
## Budget & Pricing

The "Recommended Line Items" section MUST be a Markdown table with columns: Item, Category, Description, Unit price. Reference only catalog products by their exact name. Omit this section entirely if the catalog is empty.

${REFERENCE_RULE}

Be specific, professional, and ground every claim in the sources above. Return only the Markdown content, no preamble.`

  const userContent = [
    `## CONSULTANT NOTES (authoritative)\n${notesText || '(none)'}`,
    `## PRIMARY TRANSCRIPT (browser audio)\n${browserTranscript || '(none)'}`,
    recallTranscript ? `## FALLBACK TRANSCRIPT (Recall.ai)\n${recallTranscript}` : null,
    liveContext ? `## IN-MEETING CO-PILOT CONVERSATION\n${liveContext}` : null,
    `## POST-MEETING Q&A\n${qaContext || '(none)'}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6144,
    system: buildSystemBlocks(instructions, catalogBlock, referenceProposals),
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
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
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

interface PostMeetingChatInput {
  browserTranscript: string
  recallTranscript: string
  notesText: string
  products: Product[]
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  liveChatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  referenceProposals?: ReferenceSummaryInput[]
}

export function streamPostMeetingChat({
  browserTranscript,
  recallTranscript,
  notesText,
  products,
  chatHistory,
  liveChatHistory,
  referenceProposals,
}: PostMeetingChatInput) {
  const messages: Anthropic.MessageParam[] = chatHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Start the post-meeting Q&A.' })
  }

  const liveContext = liveChatHistory
    .map((m) => `${m.role === 'assistant' ? 'Co-pilot' : 'Consultant'}: ${m.content}`)
    .join('\n\n')

  const catalogBlock = renderCatalog(products)

  const instructions = `You are preparing to write a project proposal based on a client meeting.
You will draft questions targeted to fill the gaps that matter for matching the user's catalog to what the client said.

Source priority (highest to lowest authority):
1. Consultant's notes — authoritative.
2. Post-meeting Q&A — authoritative.
3. Browser transcript (primary audio) — higher fidelity.
4. Recall.ai transcript (fallback audio) — use only to fill gaps.
5. In-meeting co-pilot conversation — hypotheses, not decisions.

Your job: ask the consultant 3-5 targeted questions ONE AT A TIME to fill gaps. Prioritize questions that determine WHICH catalog products to recommend and at what quantity/configuration — budget range, hard deadlines, decision makers, must-have vs nice-to-have features, existing systems.

Skip any topic already settled in the notes, transcript, or earlier Q&A.

After enough questions are answered (or the consultant says they're done), reply with exactly: [READY_TO_GENERATE]`

  const contextBlock = [
    `## USER PRODUCT CATALOG\n${catalogBlock}`,
    `## CONSULTANT NOTES (authoritative)\n${notesText || '(none)'}`,
    `## PRIMARY TRANSCRIPT (browser audio)\n${browserTranscript || '(none)'}`,
    recallTranscript ? `## FALLBACK TRANSCRIPT (Recall.ai)\n${recallTranscript}` : null,
    liveContext ? `## IN-MEETING CO-PILOT CONVERSATION\n${liveContext}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: instructions, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: contextBlock, cache_control: { type: 'ephemeral' } },
  ]
  const refBlock = referenceSystemBlock(referenceProposals)
  if (refBlock) systemBlocks.push(refBlock)

  return anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemBlocks,
    messages,
  })
}

// ── Proposal refine ─────────────────────────────────────────────────
// Two-mode streaming for a focused refine drawer on the proposal page.
// `mode: 'chat'` returns conversational suggestions (Claude explains
// what it would change and asks for confirmation). `mode: 'apply'`
// returns the FULL rewritten proposal markdown that the client then
// hydrates into the Tiptap editor.

export type RefineMode = 'chat' | 'apply'

interface RefineInput {
  mode: RefineMode
  currentMarkdown: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  products: Product[]
  meetingType: MeetingType
  referenceProposals?: ReferenceSummaryInput[]
}

export function streamProposalRefine({
  mode,
  currentMarkdown,
  history,
  products,
  meetingType,
  referenceProposals,
}: RefineInput) {
  const label = MEETING_TYPE_LABELS[meetingType]
  const catalogBlock = renderCatalog(products)

  const sharedRules = `Catalog rule:
- The user's catalog is the ONLY set of offerings you may propose. Do not invent line items, services, or products that are not in the catalog.
- If the catalog is empty, prefer narrative changes over inventing pricing.

${REFERENCE_RULE}

Source priority: notes + Q&A are authoritative; transcripts are reference.`

  const chatInstructions = `You are revising an existing project proposal for a ${label} engagement, working with the consultant in a back-and-forth refinement chat.

${sharedRules}

Your behavior in this turn:
- Read the consultant's request and the CURRENT PROPOSAL below.
- Reply conversationally (3-6 sentences). Be specific about what you would change and where (which section, which line item, which sentence).
- Ask one clarifying question if the request is ambiguous.
- DO NOT rewrite the proposal here. The consultant will click "Apply changes" when ready, which triggers a separate rewrite pass.`

  const applyInstructions = `You are revising an existing project proposal for a ${label} engagement.

${sharedRules}

Your behavior in this turn:
- Apply the consultant's accumulated requests from the chat to the CURRENT PROPOSAL.
- Return ONLY the FULL revised proposal in Markdown — no preamble, no chat, no code fences around the whole thing.
- Preserve all unchanged content verbatim. Only change what the chat asked you to change.
- Keep the section structure (## Executive Summary, ## Scope of Work, ## Timeline & Milestones, ## Recommended Line Items, ## Budget & Pricing) unless the chat explicitly removed a section.`

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  if (mode === 'apply' && messages.length === 0) {
    messages.push({ role: 'user', content: 'Apply the changes we discussed.' })
  }

  const contextBlock = [
    `## USER PRODUCT CATALOG\n${catalogBlock}`,
    `## CURRENT PROPOSAL (Markdown)\n${currentMarkdown || '(empty)'}`,
  ].join('\n\n')

  const refineSystem: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: mode === 'apply' ? applyInstructions : chatInstructions,
      cache_control: { type: 'ephemeral' },
    },
    { type: 'text', text: contextBlock, cache_control: { type: 'ephemeral' } },
  ]
  const refineRefBlock = referenceSystemBlock(referenceProposals)
  if (refineRefBlock) refineSystem.push(refineRefBlock)

  return anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: mode === 'apply' ? 6144 : 768,
    system: refineSystem,
    messages,
  })
}
