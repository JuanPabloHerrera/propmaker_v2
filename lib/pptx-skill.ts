import { toFile } from '@anthropic-ai/sdk'
import { anthropic } from '@/lib/claude'
import { createServiceClient } from '@/lib/supabase/server'
import { tiptapToMarkdown, tiptapToSections } from '@/lib/tiptap'
import { buildProposalPptx } from '@/lib/pptx'
import { extractPptxTheme } from '@/lib/pptx-theme'
import type { Meeting, Proposal, UserProfile } from '@/types'

// ---------------------------------------------------------------------------
// High-fidelity PPTX build — "how Claude makes PPTs."
//
// Claude runs the built-in `pptx` Agent Skill (+ our custom pptx-proposal-deck
// skill) inside a code-execution container: it analyzes the uploaded brand
// template on EVERY slide and reproduces it, filled with the proposal's
// content, then hands back a .pptx via the Files API. This is invoked from the
// export route's background job (`after()`), never inline in the response path.
//
// On any failure (incl. missing beta access) it falls back to the instant
// pptxgenjs deck (lib/pptx.ts) so the user always gets a file.
// ---------------------------------------------------------------------------

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const TEMPLATE_BUCKET = 'reference-decks'
const OUTPUT_BUCKET = 'generated-decks'

// Heavy agentic skill work — Opus is the right tier (the app otherwise uses
// sonnet-4-6). Override with PPTX_SKILL_MODEL if cost matters.
const MODEL = process.env.PPTX_SKILL_MODEL || 'claude-opus-4-8'
// Skills run in the code-execution container; Files API moves the template in
// and the finished deck out.
const SKILL_BETAS = [
  'code-execution-2025-08-25',
  'skills-2025-10-02',
  'files-api-2025-04-14',
] as const
const FILES_BETA = ['files-api-2025-04-14'] as const

type Svc = ReturnType<typeof createServiceClient>

function safeFilename(input: string): string {
  const base = (input || 'proposal')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'proposal'
}

/**
 * Run the background deck build for a queued deck_exports job. Always resolves;
 * the outcome is written to the job row (status succeeded/failed) so the client
 * (watching via Realtime) is notified either way.
 */
export async function runDeckBuild(jobId: string): Promise<void> {
  const svc = createServiceClient()

  const { data: job } = await svc
    .from('deck_exports')
    .select('id, proposal_id, user_id, template_ref_id, filename')
    .eq('id', jobId)
    .maybeSingle()
  if (!job) return

  await svc
    .from('deck_exports')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', jobId)

  // Gather everything the deck needs.
  const [{ data: proposal }, { data: templateRef }] = await Promise.all([
    svc
      .from('proposals')
      .select('id, content_json, meeting_id')
      .eq('id', job.proposal_id)
      .maybeSingle(),
    job.template_ref_id
      ? svc
          .from('reference_proposals')
          .select('file_path, source')
          .eq('id', job.template_ref_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const meetingId = (proposal as { meeting_id?: string } | null)?.meeting_id
  const [{ data: meeting }, { data: profile }] = await Promise.all([
    meetingId
      ? svc.from('meetings').select('*').eq('id', meetingId).maybeSingle()
      : Promise.resolve({ data: null }),
    svc.from('user_profiles').select('*').eq('user_id', job.user_id).maybeSingle(),
  ])

  const m = (meeting as Meeting | null) ?? null
  const p = (profile as UserProfile | null) ?? null
  const filename =
    job.filename || safeFilename(m?.client_company || m?.title || 'proposal') + '.pptx'

  // Download the brand template bytes (may be null if the ref is gone).
  let templateBytes: ArrayBuffer | null = null
  const tplPath = (templateRef as { file_path?: string; source?: string } | null)
  if (tplPath?.file_path && tplPath.source === 'pptx_template') {
    const { data: blob } = await svc.storage
      .from(TEMPLATE_BUCKET)
      .download(tplPath.file_path)
    if (blob) templateBytes = await blob.arrayBuffer()
  }

  try {
    if (!templateBytes) {
      // No usable template → nothing to reproduce; use the fast branded deck.
      throw new Error('no-template')
    }
    const bytes = await buildViaSkill({
      templateBytes,
      proposal: (proposal as Proposal | null) ?? null,
      meeting: m,
      profile: p,
    })
    await storeAndFinish(svc, jobId, job.user_id, bytes, filename, 'skill')
  } catch (skillErr) {
    // Fast fallback so the user still gets a deck.
    try {
      const preparedOn = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const theme = templateBytes ? await extractPptxTheme(templateBytes) : null
      const buf = await buildProposalPptx({
        proposal: (proposal as Proposal | null) ?? { content_json: null },
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
        'fast',
        `skill build unavailable — used fast export (${errText(skillErr)})`,
      )
    } catch (fallbackErr) {
      await svc
        .from('deck_exports')
        .update({
          status: 'failed',
          error: `${errText(skillErr)} · fallback: ${errText(fallbackErr)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }
  }
}

/** The actual Claude-skill build: template in, reproduced .pptx bytes out. */
async function buildViaSkill(input: {
  templateBytes: ArrayBuffer
  proposal: Proposal | null
  meeting: Meeting | null
  profile: UserProfile | null
}): Promise<Buffer> {
  const { templateBytes, proposal, meeting, profile } = input

  // 1) Put the brand template into the container's input directory.
  const uploaded = await anthropic.beta.files.upload({
    file: await toFile(Buffer.from(templateBytes), 'brand-template.pptx', {
      type: PPTX_MIME,
    }),
    betas: [...FILES_BETA],
  })

  // 2) Load the custom skill alongside the built-in pptx skill (custom is
  //    optional — before it's registered we still get a strong result from
  //    pptx + the prompt).
  const skills: Array<{ type: 'anthropic' | 'custom'; skill_id: string; version: string }> = [
    { type: 'anthropic', skill_id: 'pptx', version: 'latest' },
  ]
  const customId = process.env.ANTHROPIC_PPTX_SKILL_ID
  if (customId) skills.push({ type: 'custom', skill_id: customId, version: 'latest' })

  const prompt = buildPrompt({ proposal, meeting, profile, hasCustomSkill: !!customId })

  // 3) Run it. Stream so the long agentic turn doesn't hit HTTP timeouts.
  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: [...SKILL_BETAS],
    container: { skills },
    tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'container_upload', file_id: uploaded.id },
        ],
      },
    ],
  })
  const final = await stream.finalMessage()

  // 4) Find the .pptx Claude produced (files created by bash carry a file_id in
  //    the bash result's `content` list).
  const producedIds: string[] = []
  for (const block of final.content) {
    if (block.type !== 'bash_code_execution_tool_result') continue
    const result = block.content as { type?: string; content?: Array<{ file_id?: string }> }
    if (result?.type !== 'bash_code_execution_result' || !Array.isArray(result.content)) continue
    for (const out of result.content) if (out?.file_id) producedIds.push(out.file_id)
  }
  if (producedIds.length === 0) throw new Error('build produced no files')

  // Pick the last .pptx (the final deck after any QA re-render).
  let deckFileId: string | null = null
  for (let i = producedIds.length - 1; i >= 0; i--) {
    const meta = await anthropic.beta.files.retrieveMetadata(producedIds[i], {
      betas: [...FILES_BETA],
    })
    if ((meta.filename || '').toLowerCase().endsWith('.pptx')) {
      deckFileId = producedIds[i]
      break
    }
  }
  if (!deckFileId) throw new Error('build produced no .pptx')

  const dl = await anthropic.beta.files.download(deckFileId, { betas: [...FILES_BETA] })
  return Buffer.from(await dl.arrayBuffer())
}

/** Store the finished bytes in the generated-decks bucket and finish the job. */
async function storeAndFinish(
  svc: Svc,
  jobId: string,
  userId: string,
  bytes: Buffer,
  filename: string,
  engine: 'skill' | 'fast',
  note?: string,
): Promise<void> {
  const path = `${userId}/${jobId}.pptx`
  const { error: upErr } = await svc.storage
    .from(OUTPUT_BUCKET)
    .upload(path, bytes, { contentType: PPTX_MIME, upsert: true })
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
  proposal: Proposal | null
  meeting: Meeting | null
  profile: UserProfile | null
  hasCustomSkill: boolean
}): string {
  const { proposal, meeting, profile, hasCustomSkill } = input
  const markdown = tiptapToMarkdown(proposal?.content_json ?? null).trim()
  const sections = tiptapToSections(proposal?.content_json ?? null)
    .map((s) => s.title)
    .filter(Boolean)

  const brief = (meeting as unknown as { proposal_brief?: unknown } | null)?.proposal_brief
  const briefText = brief ? JSON.stringify(brief).slice(0, 6000) : ''

  const brand: string[] = []
  const pr = profile as unknown as Record<string, unknown> | null
  if (pr?.company_name) brand.push(`Consultancy: ${String(pr.company_name)}`)
  if (Array.isArray(pr?.brand_colors) && pr.brand_colors.length)
    brand.push(`Brand colors: ${(pr.brand_colors as string[]).join(', ')}`)
  if (pr?.logo_url) brand.push(`Logo: ${String(pr.logo_url)}`)
  if (pr?.signature_name) brand.push(`Signed by: ${String(pr.signature_name)}${pr.signature_title ? `, ${String(pr.signature_title)}` : ''}`)
  const client = meeting?.client_company || meeting?.title || ''

  return [
    `You are building a polished, branded PowerPoint (.pptx) proposal deck. A brand template .pptx has been uploaded to this container's input directory (look for "brand-template.pptx" or any .pptx under the input dir).`,
    hasCustomSkill
      ? `Follow the "pptx-proposal-deck" skill's method end to end, and use the built-in "pptx" skill for the low-level PowerPoint work.`
      : `Use the built-in "pptx" skill for the PowerPoint work.`,
    '',
    `GOAL — reproduce the template faithfully on EVERY slide, then fill it with the proposal content below:`,
    `1. Inspect the uploaded template thoroughly: analyze ALL of its slides (and slide layouts) — backgrounds, titles, fonts, colors, sizes, images/logos, shapes, figures, and forms — not just the first slide.`,
    `2. Build a NEW deck that keeps the template's exact design on every slide (same backgrounds, layout, styling, fonts, and shapes), and place the proposal's content into it. Map the proposal's sections onto the template's slides; keep the template's own section titles/labels where they fit; do not leave the template's sample/placeholder text behind.`,
    `3. Language: Spanish. Do NOT invent prices, dates, or facts — omit or mark "Por confirmar" anything the content below doesn't provide. No pricing in the deck.`,
    `4. Do ONE build followed by ONE visual QA pass (render to images, check contrast/overflow/leftover sample text/alignment), fix issues, and then STOP. Save the final deck as a .pptx file in the working directory.`,
    '',
    client ? `CLIENT: ${client}` : '',
    brand.length ? `BRAND:\n${brand.join('\n')}` : '',
    sections.length ? `PROPOSAL SECTIONS (slide spine): ${sections.join(' · ')}` : '',
    briefText ? `\nSTRUCTURED BRIEF (JSON, authoritative priorities):\n${briefText}` : '',
    `\nPROPOSAL CONTENT (Markdown, authoritative):\n${markdown || '(empty)'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
