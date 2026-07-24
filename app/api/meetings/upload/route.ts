import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractReferencePdfText } from '@/lib/claude'
import {
  extractDocxText,
  decodePlainText,
  isAcceptedReferenceFile,
} from '@/lib/reference-extract'

// Node runtime: we read file bytes (Buffer) and parse DOCX with mammoth.
export const runtime = 'nodejs'
// PDF transcription calls Claude and can exceed the default ~10s window.
export const maxDuration = 60

const MAX_FILE_BYTES = 15 * 1024 * 1024
// Roomier than MAX_REFERENCE_CHARS: a transcript of a long meeting easily
// passes 40k chars (~2.5h of speech fits in 150k). Generators read the head
// of the transcript, so the tail of an extreme outlier is the right thing
// to drop.
const MAX_UPLOAD_TRANSCRIPT_CHARS = 150_000
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Create a meeting from an uploaded transcript file or pasted text.
 * The text becomes the meeting's transcript (`source='upload'`, treated as
 * primary alongside browser capture) and the meeting lands directly in
 * `completed`, so the documents hub can generate from it immediately —
 * charging the same per-document credits through the existing pipeline.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })

  const file = form.get('file')
  const pastedText = (form.get('pasted_text') as string | null)?.trim() || ''

  let text = ''

  try {
    if (file instanceof File && file.size > 0) {
      if (!isAcceptedReferenceFile(file.name, file.type)) {
        return NextResponse.json(
          { error: 'Unsupported file type. Use PDF, DOCX, TXT, or MD.' },
          { status: 415 },
        )
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File must be 15 MB or smaller.' }, { status: 413 })
      }
      const buf = await file.arrayBuffer()
      if (file.type === 'application/pdf') {
        text = await extractReferencePdfText(Buffer.from(buf).toString('base64'))
        if (!text.trim()) {
          return NextResponse.json(
            { error: "Couldn't read text from this PDF — it may be a scanned image or corrupted." },
            { status: 422 },
          )
        }
      } else if (file.type === DOCX) {
        text = await extractDocxText(buf, MAX_UPLOAD_TRANSCRIPT_CHARS)
      } else {
        text = decodePlainText(buf, MAX_UPLOAD_TRANSCRIPT_CHARS)
      }
    } else if (pastedText) {
      text = pastedText
    } else {
      return NextResponse.json(
        { error: 'Upload a file or paste the transcript text.' },
        { status: 400 },
      )
    }
  } catch (err) {
    console.error('[meetings/upload] failed to process upload:', err)
    const message = err instanceof Error ? err.message : 'Could not read the file'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  text = text.trim().slice(0, MAX_UPLOAD_TRANSCRIPT_CHARS)
  if (!text) {
    return NextResponse.json({ error: 'No readable text found.' }, { status: 422 })
  }

  // Placeholder title (must keep the "Meeting — " prefix so metadata
  // extraction — fired by the documents hub on mount — is allowed to rename it).
  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      title: `Meeting — ${dateLabel}`,
      meeting_type: 'consulting',
      meeting_url: null,
      status: 'completed',
      capture_mode: 'upload',
      attendees: [],
      deal_status: 'draft',
    })
    .select()
    .single()

  if (error || !meeting) {
    return NextResponse.json({ error: error?.message ?? 'Could not create meeting' }, { status: 500 })
  }

  // One segment holding the whole text: chunking would inject fake
  // "Speaker:" prefixes mid-transcript when generators format segments.
  const { error: segError } = await supabase.from('transcript_segments').insert({
    meeting_id: meeting.id,
    speaker: null,
    text,
    start_time: null,
    source: 'upload',
  })

  if (segError) {
    // No orphan "completed" meetings without a transcript — they'd 422 on
    // every generate click.
    await supabase.from('meetings').delete().eq('id', meeting.id)
    return NextResponse.json({ error: segError.message }, { status: 500 })
  }

  return NextResponse.json({ id: meeting.id }, { status: 201 })
}
