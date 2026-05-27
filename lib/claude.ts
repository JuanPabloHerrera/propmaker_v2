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
Given the transcript so far, suggest 3-5 sharp follow-up questions the consultant should ask next.
Return ONLY a JSON array of strings. No markdown, no explanation. Example: ["Question 1?","Question 2?"]`,
    messages: [{ role: 'user', content: `Transcript so far:\n\n${transcript}` }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
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

interface GenerateProposalInput {
  browserTranscript: string
  recallTranscript: string
  notesText: string
  products: Product[]
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  liveChatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  meetingType: MeetingType
}

export async function generateProposal({
  browserTranscript,
  recallTranscript,
  notesText,
  products,
  chatHistory,
  liveChatHistory,
  meetingType,
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
    system: [
      { type: 'text', text: instructions, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `## USER PRODUCT CATALOG\n${catalogBlock}`, cache_control: { type: 'ephemeral' } },
    ],
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
}

export function streamPostMeetingChat({
  browserTranscript,
  recallTranscript,
  notesText,
  products,
  chatHistory,
  liveChatHistory,
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

  return anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: [
      { type: 'text', text: instructions, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextBlock, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  })
}
