import mammoth from 'mammoth'
import { tiptapToText } from './tiptap'
import type { TiptapDocument } from '@/types'

// Cap the text we feed the summarizer so a huge file can't blow the prompt.
export const MAX_REFERENCE_CHARS = 40000

export const REFERENCE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
])

/** Accept by extension too — browsers often send '' or octet-stream for .md/.txt. */
export function isAcceptedReferenceFile(name: string, mime: string): boolean {
  if (REFERENCE_MIME_TYPES.has(mime)) return true
  return /\.(txt|md|markdown)$/i.test(name)
}

export const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/**
 * A .pptx uploaded as a *style template* (handled separately from text
 * references — stored + parsed for its theme, never summarized).
 */
export function isPptxFile(name: string, mime: string): boolean {
  return mime === PPTX_MIME || /\.pptx$/i.test(name)
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  // IMPORTANT: mammoth's Node build only recognizes a Node `buffer` input.
  // Passing `{ arrayBuffer }` (the browser-build key) throws
  // "Could not find file in options" for every file, so DOCX uploads always
  // failed. Convert to a Node Buffer and use the `buffer` key.
  let result
  try {
    result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
  } catch {
    throw new Error(
      'Could not read this Word file — it may be corrupted or an older .doc format. Try exporting it to PDF.',
    )
  }
  return (result.value || '').slice(0, MAX_REFERENCE_CHARS)
}

export function decodePlainText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer).slice(0, MAX_REFERENCE_CHARS)
}

export function extractInAppProposalText(doc: TiptapDocument | null | undefined): string {
  return tiptapToText(doc).slice(0, MAX_REFERENCE_CHARS)
}
