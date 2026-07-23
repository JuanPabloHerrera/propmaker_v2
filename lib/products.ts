import { anthropic } from '@/lib/claude'
import type { Product } from '@/types'

/**
 * Ask Claude which catalog products were referenced (by name or
 * concept) in the meeting transcript. Returns the matching subset of
 * IDs. Falls back to an empty list on any parse/API failure so the
 * UI degrades gracefully.
 *
 * Cheap — uses haiku-equivalent settings (small max_tokens) since
 * the task is constrained.
 */
export async function detectProductsInTranscript(
  transcript: string,
  catalog: Product[],
): Promise<string[]> {
  if (catalog.length === 0 || !transcript.trim()) return []

  // Trim catalog to id + name + category + a short description so the
  // prompt stays bounded for big catalogs.
  const catalogLines = catalog
    .slice(0, 120)
    .map(
      (p) =>
        `${p.id} | ${p.name} | ${p.category}${p.description ? ` | ${p.description.slice(0, 140)}` : ''}`,
    )
    .join('\n')

  const system = `You match catalog products to a meeting transcript.
You are given (1) a CATALOG of products as "id | name | category | short description" lines and (2) the TRANSCRIPT.

Return ONLY a JSON array of product ids — the catalog ids of products that the conversation discusses (explicitly by name, or by close synonym / clear functional reference).
- Be conservative: when in doubt, leave it out.
- Maximum 10 ids.
- No markdown, no prose, no explanation. Just the JSON array.

Example: ["b3f...","9c1..."]`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 256,
      // Thinking disabled: Sonnet 5 runs adaptive thinking when `thinking` is
      // omitted, which would spend this call's small budget on reasoning and
      // truncate the JSON. This call is latency-critical and returns structured data.
      thinking: { type: 'disabled' },
      system,
      messages: [
        {
          role: 'user',
          content: `CATALOG\n${catalogLines}\n\nTRANSCRIPT\n${transcript.slice(0, 12000)}`,
        },
      ],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '[]'
    const parsed = JSON.parse(text.trim())
    if (!Array.isArray(parsed)) return []
    const valid = new Set(catalog.map((p) => p.id))
    return parsed
      .filter((id): id is string => typeof id === 'string' && valid.has(id))
      .slice(0, 10)
  } catch {
    return []
  }
}

/** Returns the union of selected-category products, attached, and detected. */
export function unionProductIdsForGeneration(args: {
  attached: string[]
  detected: string[]
  byCategory: Product[]
}): Set<string> {
  const out = new Set<string>(args.attached)
  for (const id of args.detected) out.add(id)
  for (const p of args.byCategory) out.add(p.id)
  return out
}
