import Anthropic from '@anthropic-ai/sdk'
import { MeetingType, MEETING_TYPE_LABELS } from '@/types'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

export async function generateProposal(
  transcript: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  meetingType: MeetingType,
  liveChatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const label = MEETING_TYPE_LABELS[meetingType]

  const qaContext = chatHistory
    .map((m) => `${m.role === 'assistant' ? 'Claude' : 'You'}: ${m.content}`)
    .join('\n\n')

  const liveContext = liveChatHistory
    .map((m) => `${m.role === 'assistant' ? 'Co-pilot' : 'Consultant'}: ${m.content}`)
    .join('\n\n')

  const userContent = [
    `MEETING TRANSCRIPT:\n${transcript}`,
    liveContext ? `IN-MEETING CO-PILOT CONVERSATION (consultant talking to AI during the call):\n${liveContext}` : null,
    `POST-MEETING Q&A:\n${qaContext}`,
  ].filter(Boolean).join('\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a professional proposal writer specializing in ${label} projects.
Generate a complete, structured project proposal in Markdown format based on the meeting transcript, the consultant's in-meeting reasoning with the AI co-pilot, and the post-meeting Q&A below.

Use exactly these section headers (with ## prefix):
## Executive Summary
## Scope of Work
## Timeline & Milestones
## Budget & Pricing

Source guidelines:
- The MEETING TRANSCRIPT may contain real-time speech-to-text errors (misheard words, missing punctuation, wrong proper nouns). Treat anything that looks like a transcription glitch as low-confidence and rely on the POST-MEETING Q&A for the authoritative version.
- The IN-MEETING CO-PILOT CONVERSATION is the AI co-pilot's suggestions and the consultant's questions to it during the call. Treat it as the consultant's working hypotheses and prompts to the AI — NOT as decisions made with the client. Anything that isn't confirmed in the transcript or the Q&A should not be presented as an agreed outcome.
- The POST-MEETING Q&A is the consultant's authoritative input. When it contradicts the transcript or the co-pilot conversation, the Q&A wins.

Be specific, professional, and base every point on information you can ground in the transcript, the consultant's Q&A answers, or both.
Return only the Markdown content, no preamble.`,
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

export function streamPostMeetingChat(
  transcript: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  liveChatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
) {
  const messages: Anthropic.MessageParam[] = chatHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: 'Start the post-meeting Q&A.',
    })
  }

  const liveContext = liveChatHistory
    .map((m) => `${m.role === 'assistant' ? 'Co-pilot' : 'Consultant'}: ${m.content}`)
    .join('\n\n')

  const liveBlock = liveContext
    ? `\n\nIN-MEETING CO-PILOT CONVERSATION (the consultant's questions to the AI co-pilot and the co-pilot's suggestions during the call — these are NOT meeting decisions, only hypotheses the consultant was working through):\n${liveContext}`
    : ''

  return anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: `You are preparing to write a project proposal based on a client meeting.
The meeting transcript and the consultant's in-meeting conversation with the AI co-pilot are attached below.

Your job: ask the consultant 3-5 targeted questions ONE AT A TIME to fill in gaps before generating the proposal.
Focus on: budget range, hard deadlines, key decision makers, must-have vs nice-to-have features, existing systems.

Source guidelines:
- The MEETING TRANSCRIPT is real-time speech-to-text and may contain misheard words, wrong names, or missing punctuation. If something looks like a transcription error, ask the consultant to confirm it rather than treating it as fact.
- The IN-MEETING CO-PILOT CONVERSATION is what the AI co-pilot suggested and what the consultant asked it — it is NOT a record of decisions agreed with the client. Don't assume a topic is settled just because the co-pilot suggested it; confirm with the consultant.
- Skip any topic that the consultant has clearly already answered or confirmed (in the transcript or this Q&A).

After the user has answered enough questions (or explicitly says they are done), reply with exactly: [READY_TO_GENERATE]

MEETING TRANSCRIPT:
${transcript}${liveBlock}`,
    messages,
  })
}
