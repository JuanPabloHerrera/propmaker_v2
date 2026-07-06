export type MeetingType = 'software' | 'real_estate' | 'consulting' | 'custom'
export type MeetingStatus = 'pending' | 'active' | 'completed' | 'failed'
export type ProposalStatus = 'draft' | 'final'
export type ChatRole = 'assistant' | 'user'
export type CaptureMode = 'browser' | 'recall' | 'both'
export type TranscriptSource = 'browser' | 'recall'
export type PriceUnit = 'fixed' | 'hour' | 'day' | 'sqm' | 'project' | 'unit' | 'month'
export type DealStatus = 'draft' | 'proposal_sent' | 'won' | 'lost' | 'upcoming'

export interface MeetingAttendee {
  name: string
  email?: string
  color?: string
}

export interface UserProfile {
  user_id: string
  full_name: string | null
  company_name: string | null
  tagline: string | null
  website: string | null
  industry: string | null
  voice_tones: string[]
  tone_prompt: string | null
  signature_name: string | null
  signature_title: string | null
  brand_colors: string[]
  logo_url: string | null
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export interface Meeting {
  id: string
  user_id: string
  title: string
  meeting_type: MeetingType
  recall_bot_id: string | null
  meeting_url: string | null
  scheduled_at: string | null
  status: MeetingStatus
  capture_mode: CaptureMode
  selected_categories: string[]
  notes_json: TiptapDocument | null
  attendees: MeetingAttendee[]
  context_summary: string | null
  client_company: string | null
  client_value: number | null
  attached_product_ids: string[]
  detected_product_ids: string[]
  deal_status: DealStatus
  live_partial: string | null
  created_at: string
  updated_at: string
}

export interface TranscriptSegment {
  id: string
  meeting_id: string
  speaker: string | null
  text: string
  start_time: number | null
  source: TranscriptSource
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  name: string
  category: string
  description: string | null
  price_amount: number | null
  price_unit: PriceUnit | null
  currency: string
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
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
  public_slug: string | null
  shared_at: string | null
  first_opened_at: string | null
  open_count: number
  created_at: string
  updated_at: string
}

export interface ProposalShare {
  id: string
  proposal_id: string
  recipient_email: string
  sent_at: string
  opened_at: string | null
  message_body: string | null
}

export type ReferenceProposalSource = 'uploaded' | 'app_proposal' | 'pptx_template'

/** Slide background extracted from a template deck (hex colors carry no '#'). */
export interface PptxThemeBackground {
  type: 'color' | 'image'
  color?: string
  dataUri?: string
}

/**
 * Visual theme extracted from an uploaded .pptx template — colors, fonts, and
 * background — used to style the exported proposal deck. All hex values omit '#'.
 */
export interface PptxTheme {
  accent: string
  accent2: string
  ink: string
  muted: string
  faint: string
  hairline: string
  majorFont: string
  minorFont: string
  background?: PptxThemeBackground
  zebra: [string, string]
}

export interface ReferenceProposal {
  id: string
  user_id: string
  title: string
  category: string | null
  summary: string
  source: ReferenceProposalSource
  source_proposal_id: string | null
  original_filename: string | null
  // Only set for source==='pptx_template': storage path + extracted display theme.
  file_path?: string | null
  theme_json?: PptxTheme | null
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

export const CAPTURE_MODE_LABELS: Record<CaptureMode, string> = {
  browser: 'Local mic',
  recall: 'Conferencing (bot)',
  both: 'Conferencing',
}

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  fixed: 'Fixed price',
  hour: 'Per hour',
  day: 'Per day',
  sqm: 'Per m²',
  project: 'Per project',
  unit: 'Per unit',
  month: 'Per month',
}

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Draft',
  proposal_sent: 'Proposal sent',
  won: 'Won',
  lost: 'Lost',
  upcoming: 'Upcoming',
}

export const VOICE_TONES = [
  'Warm & direct',
  'Confident',
  'Editorial',
  'Plain-spoken',
  'Pithy',
  'Premium',
] as const
export type VoiceTone = (typeof VOICE_TONES)[number]
