/**
 * Billing configuration — the single source of truth for credit economics.
 * Change credit amounts / prices here (plus the matching Stripe prices).
 *
 * Ladder rationale: prices fixed at $17/$67/$107/$197; credits per tier set
 * by the owner (200/800/1,300/2,440). Effective price per document runs
 * $8.50 → $7.88, keeping ~59–62% gross margin even at the worst-case all-in
 * cost per deal (~$3.24: 30-min bot meeting, high estimate, with refine —
 * see Proposalmaker_Costs.xlsx), comfortably above the 45% floor. Per-credit
 * price declines monotonically so bigger plans are always better value.
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
    monthlyCredits: 800,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_PRO,
    blurb: '8 documents a month — for steady deal flow.',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceUsd: 107,
    monthlyCredits: 1300,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_BUSINESS,
    blurb: '13 documents a month — for busy consultants.',
  },
  {
    id: 'agency',
    name: 'Agency',
    priceUsd: 197,
    monthlyCredits: 2440,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_AGENCY,
    blurb: '25 documents a month — for teams closing every week.',
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
