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

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return (result.value || '').slice(0, MAX_REFERENCE_CHARS)
}

export function decodePlainText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer).slice(0, MAX_REFERENCE_CHARS)
}

export function extractInAppProposalText(doc: TiptapDocument | null | undefined): string {
  return tiptapToText(doc).slice(0, MAX_REFERENCE_CHARS)
}
