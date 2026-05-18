export type MeetingType = 'software' | 'real_estate' | 'consulting' | 'custom'
export type MeetingStatus = 'pending' | 'active' | 'completed' | 'failed'
export type ProposalStatus = 'draft' | 'final'
export type ChatRole = 'assistant' | 'user'

export interface Meeting {
  id: string
  user_id: string
  title: string
  meeting_type: MeetingType
  recall_bot_id: string | null
  meeting_url: string | null
  scheduled_at: string | null
  status: MeetingStatus
  created_at: string
  updated_at: string
}

export interface TranscriptSegment {
  id: string
  meeting_id: string
  speaker: string | null
  text: string
  start_time: number | null
  created_at: string
}

export interface Suggestion {
  id: string
  meeting_id: string
  questions: string[]
  created_at: string
}

export interface PostMeetingChatMessage {
  id: string
  meeting_id: string
  role: ChatRole
  content: string
  created_at: string
}

export interface Proposal {
  id: string
  meeting_id: string
  user_id: string
  content_json: TiptapDocument | null
  status: ProposalStatus
  created_at: string
  updated_at: string
}

export interface TiptapDocument {
  type: 'doc'
  content: TiptapNode[]
}

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  software: 'Software / Tech',
  real_estate: 'Real Estate / Architecture',
  consulting: 'Consulting / Services',
  custom: 'Custom',
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  pending: 'Pending',
  active: 'Live',
  completed: 'Completed',
  failed: 'Failed',
}
