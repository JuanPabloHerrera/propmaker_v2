/**
 * Register (or version) our `pptx-proposal-deck` skill with the Anthropic
 * Skills API so the app's export can load it alongside the built-in `pptx`
 * skill inside the code-execution container.
 *
 * Run once (and again whenever the skill changes):
 *
 *   set -a; source .env.local; set +a          # or export ANTHROPIC_API_KEY
 *   npx tsx scripts/register-pptx-skill.ts
 *
 * First run prints a skill id (skill_...). Put it in the app env as
 * ANTHROPIC_PPTX_SKILL_ID (Vercel + .env.local). If ANTHROPIC_PPTX_SKILL_ID is
 * already set, this uploads a NEW VERSION of that skill instead of creating one.
 *
 * Packaging notes (do NOT edit the local skill for this — the transforms are
 * applied only to the uploaded copy, so Claude Code keeps working):
 *  - SKILL.md `description` is shortened to satisfy the API's 1024-char cap.
 *  - A short "you're in the API container" note is injected after the
 *    frontmatter so Claude uses the built-in pptx skill's tools and ignores this
 *    skill's Claude-Code-cloud `/mnt/skills/public/pptx/...` paths.
 */
import Anthropic, { toFile } from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'

const SKILL_DIR = path.join(process.cwd(), '.claude/skills/pptx-proposal-deck')
const ROOT = 'pptx-proposal-deck' // common top-level dir the API extracts
const SKILLS_BETA = 'skills-2025-10-02'

// API description cap is 1024 chars — the local one is a long paragraph.
const SHORT_DESCRIPTION =
  'Builds the PowerPoint (.pptx) version of a PropMaker proposal from the ' +
  'proposal narrative and a brand template. Mode A replicates an uploaded ' +
  'template exactly (same backgrounds, styling, titles, sizes, every shape) ' +
  'via inspect_template.py + references/template-replication.md; Mode B builds ' +
  'an own branded design via scripts/build_deck.js. Adapts the slide count to ' +
  'the content; Spanish by default; no prices. Use whenever asked for the ' +
  'pptx / deck / presentation of a proposal and a brand template is available.'

const CONTAINER_NOTE = [
  '> **Running in the Claude API code-execution container.** The built-in `pptx`',
  "> skill is also loaded here — read its SKILL.md and use ITS tools for the",
  '> low-level PowerPoint work (unpack, build, rezip, render/thumbnail for QA).',
  "> Ignore any absolute `/mnt/skills/public/pptx/...` paths in this skill's",
  '> references — locate the equivalent tool in this container instead',
  '> (e.g. `find / -name rezip.py 2>/dev/null`). The uploaded brand template',
  '> `.pptx` is in the container input directory. There is no network access.',
  '',
].join('\n')

function loadDotEnvLocal(): void {
  if (process.env.ANTHROPIC_API_KEY) return
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    const val = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'node_modules' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, base))
    else out.push(path.relative(base, full))
  }
  return out
}

/** Shorten the frontmatter description + inject the container note (upload copy). */
function transformSkillMd(src: string): string {
  const out = src.replace(/^description:.*$/m, `description: ${SHORT_DESCRIPTION}`)
  // Insert the note right after the closing '---' of the YAML frontmatter.
  const fm = /^---\n[\s\S]*?\n---\n/.exec(out)
  if (!fm) return out
  const end = fm.index + fm[0].length
  return out.slice(0, end) + '\n' + CONTAINER_NOTE + out.slice(end)
}

async function main() {
  loadDotEnvLocal()
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. `set -a; source .env.local; set +a` first.')
    process.exit(1)
  }
  if (!fs.existsSync(SKILL_DIR)) {
    console.error(`Skill dir not found: ${SKILL_DIR}`)
    process.exit(1)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const rels = walk(SKILL_DIR)
  const files = await Promise.all(
    rels.map(async (rel) => {
      const abs = path.join(SKILL_DIR, rel)
      let buf = fs.readFileSync(abs)
      if (rel === 'SKILL.md') buf = Buffer.from(transformSkillMd(buf.toString('utf8')), 'utf8')
      // Common top-level dir + POSIX separators for the multipart filename.
      const name = `${ROOT}/${rel.split(path.sep).join('/')}`
      return toFile(buf, name)
    }),
  )
  console.log(`Packaging ${files.length} files from ${SKILL_DIR}`)

  const existing = process.env.ANTHROPIC_PPTX_SKILL_ID
  if (existing) {
    const version = await client.beta.skills.versions.create(existing, {
      files,
      betas: [SKILLS_BETA],
    })
    console.log(`Uploaded new version of ${existing}: ${JSON.stringify(version, null, 2)}`)
    return
  }

  const skill = await client.beta.skills.create({
    display_title: 'PropMaker PPTX Proposal Deck',
    files,
    betas: [SKILLS_BETA as never],
  })
  console.log('\nCreated skill:')
  console.log(`  id:             ${skill.id}`)
  console.log(`  latest_version: ${skill.latest_version}`)
  console.log('\nNext: set ANTHROPIC_PPTX_SKILL_ID in .env.local and Vercel:')
  console.log(`  ANTHROPIC_PPTX_SKILL_ID=${skill.id}\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
