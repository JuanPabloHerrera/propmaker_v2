/**
 * Billing configuration — the single source of truth for credit economics.
 * Change credit amounts / prices here (plus the matching Stripe prices).
 *
 * Ladder rationale: prices fixed at $17/$67/$107/$197; credits sized so the
 * effective price per document ($8.50 → $5.97) keeps ≥45% gross margin even
 * at the worst-case all-in cost per deal (~$3.24: 30-min bot meeting, high
 * estimate, with refine — see Proposalmaker_Costs.xlsx). Per-credit price
 * declines monotonically so bigger plans are always better value.
 */

/** Credits consumed by generating one document (any doc_type). */
export const DOCUMENT_CREDIT_COST = 97

/** Free credits granted at signup. Mirrored in supabase/migrations/022_credits.sql — keep in sync. */
export const SIGNUP_GRANT = 200

export interface BillingPlan {
  id: 'starter' | 'pro' | 'business' | 'agency'
  name: string
  priceUsd: number
  /** Credits granted every billing cycle (roll over while subscribed). */
  monthlyCredits: number
  stripePriceId: string | undefined
  blurb: string
  highlight?: boolean
}

export interface CreditPack {
  id: 'pack_100'
  name: string
  priceUsd: number
  credits: number
  stripePriceId: string | undefined
  blurb: string
}

export const PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 17,
    monthlyCredits: 200,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_STARTER,
    blurb: '2 documents a month — for the occasional proposal.',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 67,
    monthlyCredits: 970,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_PRO,
    blurb: '10 documents a month — for steady deal flow.',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceUsd: 107,
    monthlyCredits: 1650,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_BUSINESS,
    blurb: '17 documents a month — for busy consultants.',
  },
  {
    id: 'agency',
    name: 'Agency',
    priceUsd: 197,
    monthlyCredits: 3200,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_AGENCY,
    blurb: '33 documents a month — for teams closing every week.',
  },
]

export const PACKS: CreditPack[] = [
  {
    id: 'pack_100',
    name: 'Top-up pack',
    priceUsd: 10,
    credits: 100,
    stripePriceId: process.env.STRIPE_PRICE_PACK_100,
    blurb: '100 credits, one-time — enough for one more document.',
  },
]

export function planById(id: string): BillingPlan | null {
  return PLANS.find((p) => p.id === id) ?? null
}

export function packById(id: string): CreditPack | null {
  return PACKS.find((p) => p.id === id) ?? null
}

/** Resolve a plan from a Stripe price id (used by the invoice.paid webhook). */
export function planByPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null
  return PLANS.find((p) => p.stripePriceId === priceId) ?? null
}
