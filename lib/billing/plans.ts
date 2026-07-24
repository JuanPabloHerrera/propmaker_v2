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
 *
 * PACKS mirror PLANS one-for-one — same price, same credits, bought once
 * instead of monthly. Each pack needs its own Stripe one-time price; the
 * recurring plan price ids can NOT be reused for mode:'payment' checkouts.
 *
 * PRICE_MXN — USD stays the base currency of every Stripe price and the unit
 * all margin math is done in; `priceMxn` is applied as Stripe
 * currency_options[mxn] so Mexican buyers can be charged in pesos. This is not
 * a nicety: MXN-only Mexican cards CANNOT be charged in USD at the network
 * level, and Adaptive Pricing can't help — it requires the price currency to be
 * a settlement currency, and an MX Stripe account settles only in MXN. Charging
 * MXN also avoids Stripe's 2% conversion fee on USD charges.
 *
 * The peso amounts are FIXED, not FX-linked. They were set at ~17.5 MXN/USD,
 * each rounded just above USD parity; the peso can weaken to ~17.75 before any
 * tier drops below its dollar price. Revisit if it moves materially.
 */

/** Credits consumed by generating one document (any doc_type). */
export const DOCUMENT_CREDIT_COST = 97

/** Free credits granted at signup. Mirrored in supabase/migrations/022_credits.sql — keep in sync. */
export const SIGNUP_GRANT = 200

export interface BillingPlan {
  id: 'starter' | 'pro' | 'business' | 'agency'
  name: string
  priceUsd: number
  /** See PRICE_MXN note above. Applied as Stripe currency_options[mxn]. */
  priceMxn: number
  /** Credits granted every billing cycle (roll over while subscribed). */
  monthlyCredits: number
  stripePriceId: string | undefined
  blurb: string
  highlight?: boolean
}

export interface CreditPack {
  id: 'pack_starter' | 'pack_pro' | 'pack_business' | 'pack_agency'
  name: string
  priceUsd: number
  /** See PRICE_MXN note above. Applied as Stripe currency_options[mxn]. */
  priceMxn: number
  credits: number
  stripePriceId: string | undefined
  blurb: string
}

export const PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 17,
    priceMxn: 299,
    monthlyCredits: 200,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_STARTER,
    blurb: '2 documents a month — for the occasional proposal.',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 67,
    priceMxn: 1199,
    monthlyCredits: 800,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_PRO,
    blurb: '8 documents a month — for steady deal flow.',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceUsd: 107,
    priceMxn: 1899,
    monthlyCredits: 1300,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_BUSINESS,
    blurb: '13 documents a month — for busy consultants.',
  },
  {
    id: 'agency',
    name: 'Agency',
    priceUsd: 197,
    priceMxn: 3499,
    monthlyCredits: 2440,
    stripePriceId: process.env.STRIPE_PRICE_PLAN_AGENCY,
    blurb: '25 documents a month — for teams closing every week.',
  },
]

export const PACKS: CreditPack[] = [
  {
    id: 'pack_starter',
    name: 'Starter pack',
    priceUsd: 17,
    priceMxn: 299,
    credits: 200,
    stripePriceId: process.env.STRIPE_PRICE_PACK_STARTER,
    blurb: '2 documents, no subscription.',
  },
  {
    id: 'pack_pro',
    name: 'Pro pack',
    priceUsd: 67,
    priceMxn: 1199,
    credits: 800,
    stripePriceId: process.env.STRIPE_PRICE_PACK_PRO,
    blurb: '8 documents, no subscription.',
  },
  {
    id: 'pack_business',
    name: 'Business pack',
    priceUsd: 107,
    priceMxn: 1899,
    credits: 1300,
    stripePriceId: process.env.STRIPE_PRICE_PACK_BUSINESS,
    blurb: '13 documents, no subscription.',
  },
  {
    id: 'pack_agency',
    name: 'Agency pack',
    priceUsd: 197,
    priceMxn: 3499,
    credits: 2440,
    stripePriceId: process.env.STRIPE_PRICE_PACK_AGENCY,
    blurb: '25 documents, no subscription.',
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
