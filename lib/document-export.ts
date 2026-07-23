import { toFile } from '@anthropic-ai/sdk'
import { anthropic } from '@/lib/claude'
import { createServiceClient } from '@/lib/supabase/server'
import { tiptapToMarkdown, tiptapToSections } from '@/lib/tiptap'
import { buildProposalPptx } from '@/lib/pptx'
import { extractPptxTheme } from '@/lib/pptx-theme'
import { DOC_TYPE_LABELS, type Meeting, type MeetingDocument, type UserProfile } from '@/types'

// ---------------------------------------------------------------------------
// High-fidelity document export — "how Claude makes files."
//
// Claude runs the relevant built-in document Agent Skill (pptx / docx / pdf,
// plus our custom pptx-proposal-deck skill for decks) inside a code-execution
// container and hands back the finished file via the Files API. Works for all
// three document types (minute / summary / proposal) and all three formats.
// Invoked from the export route's background job (`after()`), never inline.
//
// Fallback: pptx falls back to the instant pptxgenjs deck (lib/pptx.ts) so the
// user always gets a deck. docx/pdf have no fast engine — the job fails
// cleanly and the client offers the print route for PDF.
// ---------------------------------------------------------------------------

export type ExportFormat = 'pptx' | 'docx' | 'pdf'

const FORMAT_MIME: Record<ExportFormat, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
}

const TEMPLATE_BUCKET = 'reference-decks'
const OUTPUT_BUCKET = 'generated-decks'

// Heavy agentic skill work — Opus is the right tier (the app otherwise uses
// sonnet-4-6). Override with PPTX_SKILL_MODEL if cost matters.
const MODEL = process.env.PPTX_SKILL_MODEL || 'claude-opus-4-8'
// Skills run in the code-execution container; Files API moves the template in
// and the finished file out.
const SKILL_BETAS = [
  'code-execution-2025-08-25',
  'skills-2025-10-02',
  'files-api-2025-04-14',
] as const
const FILES_BETA = ['files-api-2025-04-14'] as const

type Svc = ReturnType<typeof createServiceClient>

function safeFilename(input: string): string {
  const base = (input || 'document')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'document'
}

/**
 * Run the background build for a queued deck_exports job. Always resolves; the
 * outcome is written to the job row (status succeeded/failed) so the client
 * (watching via Realtime) is notified either way.
 */
export async function runDocumentExport(jobId: string): Promise<void> {
  const svc = createServiceClient()

  const { data: job } = await svc
    .from('deck_exports')
    .select('id, document_id, user_id, template_ref_id, filename, format')
    .eq('id', jobId)
    .maybeSingle()
  if (!job) return

  const format = ((job.format as string | null) ?? 'pptx') as ExportFormat

  await svc
    .from('deck_exports')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', jobId)

  // Gather everything the build needs.
  const [{ data: document }, { data: templateRef }] = await Promise.all([
    svc
      .from('meeting_documents')
      .select('id, content_json, meeting_id, doc_type, title, language')
      .eq('id', job.document_id)
      .maybeSingle(),
    job.template_ref_id
      ? svc
          .from('reference_proposals')
          .select('file_path, source')
          .eq('id', job.template_ref_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const doc = (document as MeetingDocument | null) ?? null
  const meetingId = doc?.meeting_id
  const [{ data: meeting }, { data: profile }] = await Promise.all([
    meetingId
      ? svc.from('meetings').select('*').eq('id', meetingId).maybeSingle()
      : Promise.resolve({ data: null }),
    svc.from('user_profiles').select('*').eq('user_id', job.user_id).maybeSingle(),
  ])

  const m = (meeting as Meeting | null) ?? null
  const p = (profile as UserProfile | null) ?? null
  const filename =
    job.filename ||
    `${safeFilename(doc?.title || m?.client_company || m?.title || 'document')}.${format}`

  // Download the brand template bytes (pptx only; may be null if the ref is gone).
  let templateBytes: ArrayBuffer | null = null
  const tplPath = (templateRef as { file_path?: string; source?: string } | null)
  if (format === 'pptx' && tplPath?.file_path && tplPath.source === 'pptx_template') {
    const { data: blob } = await svc.storage
      .from(TEMPLATE_BUCKET)
      .download(tplPath.file_path)
    if (blob) templateBytes = await blob.arrayBuffer()
  }

  try {
    const bytes = await buildViaSkill({
      format,
      templateBytes,
      document: doc,
      meeting: m,
      profile: p,
    })
    await storeAndFinish(svc, jobId, job.user_id, bytes, filename, format, 'skill')
  } catch (skillErr) {
    if (format === 'pptx') {
      // Fast fallback so the user still gets a deck.
      try {
        const preparedOn = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        const theme = templateBytes ? await extractPptxTheme(templateBytes) : null
        const buf = await buildProposalPptx({
          proposal: doc ?? { content_json: null },
          meeting: m,
          profile: p,
          preparedOn,
          template: theme,
        })
        await storeAndFinish(
          svc,
          jobId,
          job.user_id,
          buf,
          filename,
          format,
          'fast',
          `skill build unavailable — used fast export (${errText(skillErr)})`,
        )
        return
      } catch (fallbackErr) {
        await svc
          .from('deck_exports')
          .update({
            status: 'failed',
            error: `${errText(skillErr)} · fallback: ${errText(fallbackErr)}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId)
        return
      }
    }
    // docx/pdf: no fast engine — fail cleanly (the client offers print for PDF).
    await svc
      .from('deck_exports')
      .update({
        status: 'failed',
        error: errText(skillErr),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}

/** The actual Claude-skill build: (optional) template in, file bytes out. */
async function buildViaSkill(input: {
  format: ExportFormat
  templateBytes: ArrayBuffer | null
  document: MeetingDocument | null
  meeting: Meeting | null
  profile: UserProfile | null
}): Promise<Buffer> {
  const { format, templateBytes, document, meeting, profile } = input
  const hasTemplate = !!templateBytes

  // 1) When a template is provided (pptx only), put it into the container's
  //    input directory.
  let uploadedId: string | null = null
  if (templateBytes) {
    const uploaded = await anthropic.beta.files.upload({
      file: await toFile(Buffer.from(templateBytes), 'brand-template.pptx', {
        type: FORMAT_MIME.pptx,
      }),
      betas: [...FILES_BETA],
    })
    uploadedId = uploaded.id
  }

  // 2) Load the built-in skill for the format. For PROPOSAL decks, our custom
  //    pptx-proposal-deck skill rides along (optional — before it's registered
  //    we still get a strong result from pptx + the prompt). Minute/summary
  //    decks skip it: its B2B proposal arc doesn't fit them.
  const skills: Array<{ type: 'anthropic' | 'custom'; skill_id: string; version: string }> = [
    { type: 'anthropic', skill_id: format, version: 'latest' },
  ]
  const customId = process.env.ANTHROPIC_PPTX_SKILL_ID
  const useCustomSkill =
    format === 'pptx' && !!customId && (document?.doc_type ?? 'proposal') === 'proposal'
  if (useCustomSkill) {
    skills.push({ type: 'custom', skill_id: customId!, version: 'latest' })
  }

  const prompt = buildPrompt({
    format,
    document,
    meeting,
    profile,
    hasCustomSkill: useCustomSkill,
    hasTemplate,
  })

  // 3) Run it. Stream so the long agentic turn doesn't hit HTTP timeouts. The
  //    container_upload block is only sent when we actually uploaded a template.
  const content: Array<
    { type: 'text'; text: string } | { type: 'container_upload'; file_id: string }
  > = [{ type: 'text', text: prompt }]
  if (uploadedId) content.push({ type: 'container_upload', file_id: uploadedId })

  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: [...SKILL_BETAS],
    container: { skills },
    tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
    messages: [{ role: 'user', content }],
  })
  const final = await stream.finalMessage()

  // 4) Find the file Claude produced (files created by bash carry a file_id in
  //    the bash result's `content` list).
  const producedIds: string[] = []
  for (const block of final.content) {
    if (block.type !== 'bash_code_execution_tool_result') continue
    const result = block.content as { type?: string; content?: Array<{ file_id?: string }> }
    if (result?.type !== 'bash_code_execution_result' || !Array.isArray(result.content)) continue
    for (const out of result.content) if (out?.file_id) producedIds.push(out.file_id)
  }
  if (producedIds.length === 0) throw new Error('build produced no files')

  // Pick the last file with the requested extension (the final one after QA).
  const wantedExt = `.${format}`
  let fileId: string | null = null
  for (let i = producedIds.length - 1; i >= 0; i--) {
    const meta = await anthropic.beta.files.retrieveMetadata(producedIds[i], {
      betas: [...FILES_BETA],
    })
    if ((meta.filename || '').toLowerCase().endsWith(wantedExt)) {
      fileId = producedIds[i]
      break
    }
  }
  if (!fileId) throw new Error(`build produced no ${wantedExt}`)

  const dl = await anthropic.beta.files.download(fileId, { betas: [...FILES_BETA] })
  return Buffer.from(await dl.arrayBuffer())
}

/** Store the finished bytes in the generated-decks bucket and finish the job. */
async function storeAndFinish(
  svc: Svc,
  jobId: string,
  userId: string,
  bytes: Buffer,
  filename: string,
  format: ExportFormat,
  engine: 'skill' | 'fast',
  note?: string,
): Promise<void> {
  const path = `${userId}/${jobId}.${format}`
  const { error: upErr } = await svc.storage
    .from(OUTPUT_BUCKET)
    .upload(path, bytes, { contentType: FORMAT_MIME[format], upsert: true })
  if (upErr) {
    await svc
      .from('deck_exports')
      .update({
        status: 'failed',
        error: `storage upload failed: ${upErr.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    return
  }
  await svc
    .from('deck_exports')
    .update({
      status: 'succeeded',
      engine,
      file_path: path,
      filename,
      error: note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

function buildPrompt(input: {
  format: ExportFormat
  document: MeetingDocument | null
  meeting: Meeting | null
  profile: UserProfile | null
  hasCustomSkill: boolean
  hasTemplate: boolean
}): string {
  const { format, document, meeting, profile, hasCustomSkill, hasTemplate } = input
  const markdown = tiptapToMarkdown(document?.content_json ?? null).trim()
  const sections = tiptapToSections(document?.content_json ?? null)
    .map((s) => s.title)
    .filter(Boolean)

  const docType = document?.doc_type ?? 'proposal'
  const docLabel = DOC_TYPE_LABELS[docType]
  const language = document?.language || meeting?.language || 'es'
  const languageRule = `Language: write everything in the language with ISO code "${language}" (the document's language).`

  const brand: string[] = []
  const pr = profile as unknown as Record<string, unknown> | null
  if (pr?.company_name) brand.push(`Consultancy: ${String(pr.company_name)}`)
  if (Array.isArray(pr?.brand_colors) && pr.brand_colors.length)
    brand.push(`Brand colors: ${(pr.brand_colors as string[]).join(', ')}`)
  if (pr?.logo_url) brand.push(`Logo: ${String(pr.logo_url)}`)
  if (pr?.signature_name) brand.push(`Signed by: ${String(pr.signature_name)}${pr.signature_title ? `, ${String(pr.signature_title)}` : ''}`)
  const client = meeting?.client_company || meeting?.title || ''

  let head: string[]
  if (format === 'pptx') {
    // Mode A (template uploaded) vs Mode B (brand-only own design). Shared rules
    // (document language, no invented facts, one build + one QA pass).
    const modeA = [
      `You are building a polished, branded PowerPoint (.pptx) deck for the ${docLabel.toLowerCase()} below. A brand template .pptx has been uploaded to this container's input directory (look for "brand-template.pptx" or any .pptx under the input dir).`,
      hasCustomSkill
        ? `Follow the "pptx-proposal-deck" skill's Mode A (replicate the template) end to end, and use the built-in "pptx" skill for the low-level PowerPoint work.`
        : `Use the built-in "pptx" skill for the PowerPoint work.`,
      '',
      `GOAL — reproduce the template faithfully on EVERY slide, then fill it with the document content below:`,
      `1. Inspect the uploaded template thoroughly: analyze ALL of its slides (and slide layouts) — backgrounds, titles, fonts, colors, sizes, images/logos, shapes, figures, and forms — not just the first slide.`,
      `2. Build a NEW deck that keeps the template's exact design on every slide (same backgrounds, layout, styling, fonts, and shapes), and place the document's content into it. Map the document's sections onto the template's slides; keep the template's own section titles/labels where they fit; do not leave the template's sample/placeholder text behind.`,
      `3. ${languageRule} Do NOT invent prices, dates, or facts — omit or mark as "to be confirmed" anything the content below doesn't provide. No pricing in the deck.`,
      `4. Do ONE build followed by ONE visual QA pass (render to images, check contrast/overflow/leftover sample text/alignment), fix issues, and then STOP. Save the final deck as a .pptx file in the working directory.`,
    ]
    const modeB = [
      `You are building a polished, branded PowerPoint (.pptx) deck for the ${docLabel.toLowerCase()} below. There is NO template file — design the deck yourself from the BRAND below.`,
      hasCustomSkill
        ? `Follow the "pptx-proposal-deck" skill's Mode B (own branded design) end to end, and use the built-in "pptx" skill for the low-level PowerPoint work.`
        : `Use the built-in "pptx" skill for the PowerPoint work, and design a clean B2B arc appropriate to the document type.`,
      '',
      `GOAL — build an original, cleanly branded deck from the BRAND below, then fill it with the document content:`,
      `1. Derive the palette from the BRAND colors (a dominant/primary and an accent) and use the logo where provided; pick a safe body font (Calibri) so it renders in Office. Use a dark/light "sandwich": dark cover/close/section openers, light body slides.`,
      `2. Adapt the slide count to the content — one detail slide per "## " section bullet group; omit sections the content doesn't support. ${docType === 'proposal' ? 'For proposals: one detail slide per "Priorities & Key Deliverables" bullet.' : `A ${docLabel.toLowerCase()} deck is SHORT — cover, one slide per section, close.`}`,
      `3. ${languageRule} Do NOT invent prices, dates, or facts — omit or mark as "to be confirmed" anything the content below doesn't provide. No pricing in the deck.`,
      `4. Do ONE build followed by ONE visual QA pass (render to images, check contrast/overflow/alignment), fix issues, and then STOP. Save the final deck as a .pptx file in the working directory.`,
    ]
    head = hasTemplate ? modeA : modeB
  } else if (format === 'docx') {
    head = [
      `You are building a polished, branded Word document (.docx) of the ${docLabel.toLowerCase()} below. Use the built-in "docx" skill.`,
      '',
      `GOAL — a clean, letter-format business document:`,
      `1. Brand it from the BRAND below: primary color for headings/accents, the consultancy name (and logo where provided) in a simple header or cover, page numbers in the footer.`,
      `2. Keep the document's section structure exactly (its "## " headings become Word headings). Preserve tables as real Word tables. Do not add content that isn't in the source.`,
      `3. ${languageRule}`,
      `4. Do ONE build, then a quick QA pass (open/convert to check layout, spacing, and table overflow), fix issues, and STOP. Save the final file as a .docx in the working directory.`,
    ]
  } else {
    head = [
      `You are building a polished, branded PDF of the ${docLabel.toLowerCase()} below. Use the built-in "pdf" skill.`,
      '',
      `GOAL — a clean, letter-format business PDF:`,
      `1. Brand it from the BRAND below: primary color for headings/accents, the consultancy name (and logo where provided) on a simple cover or header, page numbers in the footer.`,
      `2. Keep the document's section structure exactly (its "## " headings become styled headings). Preserve tables as real tables. Do not add content that isn't in the source.`,
      `3. ${languageRule}`,
      `4. Do ONE build, then a quick visual QA pass (render pages to images, check contrast/overflow/pagination), fix issues, and STOP. Save the final file as a .pdf in the working directory.`,
    ]
  }

  return [
    ...head,
    '',
    client ? `CLIENT: ${client}` : '',
    brand.length ? `BRAND:\n${brand.join('\n')}` : '',
    sections.length ? `DOCUMENT SECTIONS: ${sections.join(' · ')}` : '',
    `\nDOCUMENT CONTENT (Markdown, authoritative):\n${markdown || '(empty)'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
