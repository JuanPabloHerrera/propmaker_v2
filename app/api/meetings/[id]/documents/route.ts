import { createClient } from '@/lib/supabase/server'
import { gatherMeetingInputs } from '@/lib/meeting-inputs'
import {
  generateMeetingMinute,
  generateTranscriptSummary,
  generateProposal,
  generateNotesDocument,
  matchReferenceProposal,
} from '@/lib/claude'
import { markdownToTiptap } from '@/lib/markdown'
import { NextResponse } from 'next/server'
import type { DocType } from '@/types'

export const maxDuration = 300

const DOC_TYPES: DocType[] = ['minute', 'summary', 'proposal', 'notes']

/** List every document generated for this meeting (newest first). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('meeting_documents')
    .select('id, doc_type, title, language, status, public_slug, created_at, updated_at')
    .eq('meeting_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * Generate a document NOW. Body: { type: 'minute' | 'summary' | 'proposal' }.
 * Every click creates a new meeting_documents row (multiple docs per meeting,
 * any type, any time). Proposals first pick the most-similar past reference,
 * then generate single-pass with catalog pricing + matched-reference structure.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const type = body?.type as DocType
  if (!DOC_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'type must be minute, summary, proposal, or notes' },
      { status: 400 },
    )
  }

  const inputs = await gatherMeetingInputs(supabase, id, user.id)
  if (!inputs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!inputs.browserTranscript && !inputs.recallTranscript && !inputs.notesText) {
    return NextResponse.json(
      { error: 'This meeting has no transcript or notes to generate from yet.' },
      { status: 422 },
    )
  }

  const { data: meetingRow } = await supabase
    .from('meetings')
    .select('title')
    .eq('id', id)
    .single()
  const meetingTitle = (meetingRow?.title as string | undefined) ?? null

  try {
    let markdown = ''
    if (type === 'minute') {
      markdown = await generateMeetingMinute({
        browserTranscript: inputs.browserTranscript,
        recallTranscript: inputs.recallTranscript,
        notesText: inputs.notesText,
        liveChatHistory: inputs.liveChatHistory,
        aiSuggestions: inputs.aiSuggestions,
        attendees: inputs.attendees,
        clientCompany: inputs.clientCompany,
        language: inputs.language,
      })
    } else if (type === 'summary') {
      markdown = await generateTranscriptSummary({
        browserTranscript: inputs.browserTranscript,
        recallTranscript: inputs.recallTranscript,
        notesText: inputs.notesText,
        language: inputs.language,
      })
    } else if (type === 'notes') {
      // Notes document: polished from ONLY the consultant's own notes.
      if (!inputs.notesText) {
        return NextResponse.json(
          { error: 'This meeting has no notes yet — take some notes first.' },
          { status: 422 },
        )
      }
      markdown = await generateNotesDocument({
        notesText: inputs.notesText,
        attendees: inputs.attendees,
        clientCompany: inputs.clientCompany,
        language: inputs.language,
      })
    } else {
      // Proposal: pick the single most-similar past reference, then generate.
      const digest = [
        inputs.contextSummary ? `Context: ${inputs.contextSummary}` : null,
        inputs.clientCompany ? `Client: ${inputs.clientCompany}` : null,
        inputs.notesText ? `Notes: ${inputs.notesText.slice(0, 2000)}` : null,
        `Transcript: ${(inputs.browserTranscript || inputs.recallTranscript).slice(0, 8000)}`,
      ]
        .filter(Boolean)
        .join('\n\n')

      const match = await matchReferenceProposal({
        meetingDigest: digest,
        refs: inputs.referenceProposals.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary,
        })),
      })
      const matchedRef = match.refId
        ? (inputs.referenceProposals.find((r) => r.id === match.refId) ?? null)
        : null

      markdown = await generateProposal({
        browserTranscript: inputs.browserTranscript,
        recallTranscript: inputs.recallTranscript,
        notesText: inputs.notesText,
        products: inputs.products,
        liveChatHistory: inputs.liveChatHistory,
        aiSuggestions: inputs.aiSuggestions,
        meetingType: inputs.meetingType,
        contextSummary: inputs.contextSummary,
        clientCompany: inputs.clientCompany,
        matchedReference: matchedRef,
        language: inputs.language,
      })
    }

    if (!markdown.trim()) {
      return NextResponse.json({ error: 'Generation returned no content.' }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('meeting_documents')
      .insert({
        meeting_id: id,
        user_id: user.id,
        doc_type: type,
        title: meetingTitle,
        language: inputs.language,
        content_json: markdownToTiptap(markdown),
        status: 'draft',
      })
      .select('id, doc_type, title, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate document'
    console.error('[meetings/documents]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
