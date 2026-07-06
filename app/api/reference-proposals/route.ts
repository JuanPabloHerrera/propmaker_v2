import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { summarizeReferenceText, summarizeReferencePdf } from '@/lib/claude'
import {
  extractDocxText,
  decodePlainText,
  isAcceptedReferenceFile,
  isPptxFile,
  PPTX_MIME,
} from '@/lib/reference-extract'
import { extractPptxTheme, themeForStorage } from '@/lib/pptx-theme'

// Node runtime: we read file bytes (Buffer) and parse DOCX with mammoth.
export const runtime = 'nodejs'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_PPTX_BYTES = 25 * 1024 * 1024
const DECK_BUCKET = 'reference-decks'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })

  const file = form.get('file')
  const pastedText = (form.get('pasted_text') as string | null)?.trim() || ''
  const title = ((form.get('title') as string) || '').trim()
  const category = ((form.get('category') as string) || '').trim() || null

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  // PPTX style template: store the file + extract its theme; never summarized.
  if (file instanceof File && file.size > 0 && isPptxFile(file.name, file.type)) {
    if (file.size > MAX_PPTX_BYTES) {
      return NextResponse.json({ error: 'PowerPoint must be 25 MB or smaller.' }, { status: 413 })
    }
    const bytes = await file.arrayBuffer()
    const theme = await extractPptxTheme(bytes)
    if (!theme) {
      return NextResponse.json(
        { error: "Couldn't read this PowerPoint's theme. Make sure it's a valid .pptx." },
        { status: 422 },
      )
    }
    const path = `${user.id}/${randomUUID()}.pptx`
    const { error: upErr } = await supabase.storage
      .from(DECK_BUCKET)
      .upload(path, bytes, { contentType: PPTX_MIME, upsert: false })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data, error } = await supabase
      .from('reference_proposals')
      .insert({
        user_id: user.id,
        title,
        category,
        summary: 'PowerPoint style template',
        source: 'pptx_template',
        original_filename: file.name,
        file_path: path,
        theme_json: themeForStorage(theme),
      })
      .select()
      .single()
    if (error) {
      await supabase.storage.from(DECK_BUCKET).remove([path]).catch(() => {})
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  }

  let summary = ''
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
        summary = await summarizeReferencePdf(Buffer.from(buf).toString('base64'))
      } else if (file.type === DOCX) {
        summary = await summarizeReferenceText(await extractDocxText(buf))
      } else {
        summary = await summarizeReferenceText(decodePlainText(buf))
      }
    } else if (pastedText) {
      summary = await summarizeReferenceText(pastedText)
    } else {
      return NextResponse.json({ error: 'Upload a file or paste proposal text.' }, { status: 400 })
    }
  } catch (err) {
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
      source: 'uploaded',
      original_filename: originalFilename,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
