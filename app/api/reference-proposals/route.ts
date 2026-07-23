import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { summarizeReferenceText, summarizeReferencePdf, extractReferencePdfText } from '@/lib/claude'
import {
  extractDocxText,
  decodePlainText,
  isAcceptedReferenceFile,
  MAX_REFERENCE_CHARS,
} from '@/lib/reference-extract'
import { extractPptxTheme, themeForStorage } from '@/lib/pptx-theme'

// Node runtime: we read file bytes (Buffer) and parse DOCX with mammoth.
export const runtime = 'nodejs'
// PDF/DOCX summarization calls Claude and can exceed the default ~10s window.
export const maxDuration = 60

const MAX_FILE_BYTES = 15 * 1024 * 1024
const DECK_BUCKET = 'reference-decks'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Register a .pptx style template that the browser already uploaded directly to
 * the `reference-decks` bucket (bypasses the Vercel ~4.5MB function-body limit).
 * We download it server-side, extract its theme, and insert the row.
 */
async function registerPptxTemplate(
  request: Request,
  supabase: SupabaseClient,
  user: User,
): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as
    | { title?: string; category?: string | null; file_path?: string; original_filename?: string | null }
    | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const title = (body.title || '').trim()
  const category = (body.category || '')?.toString().trim() || null
  const filePath = (body.file_path || '').trim()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!filePath) return NextResponse.json({ error: 'Missing uploaded file path' }, { status: 400 })
  // Ownership: the object must live under the caller's own {user_id}/ folder.
  if (!filePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(DECK_BUCKET).download(filePath)
  if (dlErr || !blob) {
    return NextResponse.json({ error: 'Could not read the uploaded PowerPoint.' }, { status: 400 })
  }

  const theme = await extractPptxTheme(await blob.arrayBuffer())
  if (!theme) {
    await supabase.storage.from(DECK_BUCKET).remove([filePath]).catch(() => {})
    return NextResponse.json(
      { error: "Couldn't read this PowerPoint's theme. Make sure it's a valid .pptx." },
      { status: 422 },
    )
  }

  const { data, error } = await supabase
    .from('reference_proposals')
    .insert({
      user_id: user.id,
      title,
      category,
      summary: 'PowerPoint style template',
      source: 'pptx_template',
      original_filename: body.original_filename ?? null,
      file_path: filePath,
      theme_json: themeForStorage(theme),
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(DECK_BUCKET).remove([filePath]).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('reference_proposals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // .pptx templates are uploaded to Storage from the browser, then registered
  // here as JSON (keeps the large file off the Vercel function body).
  if ((request.headers.get('content-type') || '').includes('application/json')) {
    return registerPptxTemplate(request, supabase, user)
  }

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })

  const file = form.get('file')
  const pastedText = (form.get('pasted_text') as string | null)?.trim() || ''
  const title = ((form.get('title') as string) || '').trim()
  const category = ((form.get('category') as string) || '').trim() || null

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  let summary = ''
  // Full extracted text (≤40k chars), stored so this reference can be injected
  // verbatim when it's the matched past proposal at generation time.
  let fullText = ''
  let originalFilename: string | null = null

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
      originalFilename = file.name
      const buf = await file.arrayBuffer()
      if (file.type === 'application/pdf') {
        const pdfBase64 = Buffer.from(buf).toString('base64')
        const [pdfSummary, pdfText] = await Promise.all([
          summarizeReferencePdf(pdfBase64),
          extractReferencePdfText(pdfBase64),
        ])
        summary = pdfSummary
        fullText = pdfText
      } else if (file.type === DOCX) {
        fullText = await extractDocxText(buf)
        summary = await summarizeReferenceText(fullText)
      } else {
        fullText = decodePlainText(buf)
        summary = await summarizeReferenceText(fullText)
      }
    } else if (pastedText) {
      fullText = pastedText
      summary = await summarizeReferenceText(pastedText)
    } else {
      return NextResponse.json({ error: 'Upload a file or paste proposal text.' }, { status: 400 })
    }
  } catch (err) {
    console.error('[reference-proposals] failed to process upload:', err)
    const message = err instanceof Error ? err.message : 'Could not read the proposal'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (!summary.trim()) {
    return NextResponse.json({ error: 'Could not extract a summary from this proposal.' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('reference_proposals')
    .insert({
      user_id: user.id,
      title,
      category,
      summary,
      full_text: fullText.trim() ? fullText.slice(0, MAX_REFERENCE_CHARS) : null,
      source: 'uploaded',
      original_filename: originalFilename,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
