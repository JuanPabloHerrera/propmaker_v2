/**
 * Create the Stripe products + prices that back the credits system.
 *
 * Mirrors lib/billing/plans.ts one-for-one: 4 products (Starter / Pro /
 * Business / Agency), each with TWO prices — a monthly recurring one for the
 * subscription plan and a one-time one for the pack. A recurring price id can
 * NOT be used in a mode:'payment' checkout, which is why the packs need their
 * own prices even though the dollar amounts are identical.
 *
 * Run it once per Stripe mode (test, then live):
 *
 *   set -a; source .env.local; set +a          # or export STRIPE_SECRET_KEY
 *   npx tsx scripts/setup-stripe-prices.ts
 *
 * Test vs live is decided purely by which key is exported (sk_test_… vs
 * sk_live_…); the script prints the mode it detected before writing anything.
 *
 * Each price is USD with a `currency_options[mxn]` amount attached, so Mexican
 * buyers can be charged in pesos — MXN-only Mexican cards can't be charged in
 * USD at all, and Adaptive Pricing can't cover it (see the PRICE_MXN note in
 * plans.ts). currency_options IS mutable, so re-running updates it in place.
 *
 * Idempotent: products and prices are matched by a stable `lookup_key`
 * (plan_pro, pack_pro, …), so re-running reuses what exists instead of
 * creating duplicates. Prices are immutable in Stripe — if an amount in
 * plans.ts changes, this script refuses to reuse the mismatched price and
 * tells you to retire it and pick a new lookup key.
 *
 * Prints the eight STRIPE_PRICE_* lines to paste into .env.local (test) or
 * Vercel's env settings (live).
 */
import Stripe from 'stripe'
import { PLANS, PACKS } from '../lib/billing/plans'

interface PriceSpec {
  /** Stable identifier used both as the Stripe lookup_key and for logging. */
  lookupKey: string
  /** Env var the resulting price id belongs in. */
  envVar: string
  /** Tier key — plan and pack of the same tier share one product. */
  tier: string
  productName: string
  productDescription: string
  unitAmount: number
  /** currency_options[mxn] amount, in centavos. */
  mxnAmount: number
  credits: number
  recurring: boolean
}

const specs: PriceSpec[] = [
  ...PLANS.map((plan) => ({
    lookupKey: `plan_${plan.id}`,
    envVar: `STRIPE_PRICE_PLAN_${plan.id.toUpperCase()}`,
    tier: plan.id,
    productName: `PropMaker ${plan.name}`,
    productDescription: plan.blurb,
    unitAmount: plan.priceUsd * 100,
    mxnAmount: plan.priceMxn * 100,
    credits: plan.monthlyCredits,
    recurring: true,
  })),
  ...PACKS.map((pack) => {
    // pack ids are `pack_<tier>` — strip the prefix to share the tier product.
    const tier = pack.id.replace(/^pack_/, '')
    return {
      lookupKey: pack.id,
      envVar: `STRIPE_PRICE_PACK_${tier.toUpperCase()}`,
      tier,
      productName: `PropMaker ${pack.name.replace(/ pack$/, '')}`,
      productDescription: pack.blurb,
      unitAmount: pack.priceUsd * 100,
      mxnAmount: pack.priceMxn * 100,
      credits: pack.credits,
      recurring: false,
    }
  }),
]

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

  const mode = key.startsWith('sk_live_') ? 'LIVE' : 'TEST'
  console.log(`\nStripe mode: ${mode} (key ${key.slice(0, 12)}…)\n`)

  const stripe = new Stripe(key)
  const results: { envVar: string; priceId: string; reused: boolean }[] = []

  // One product per tier, shared by that tier's plan price and pack price.
  const productByTier = new Map<string, string>()

  for (const spec of specs) {
    let productId = productByTier.get(spec.tier)

    if (!productId) {
      // Products have no lookup_key, so we assign a deterministic id ourselves.
      // (Product search would work too, but its index lags ~a minute — a quick
      // re-run could miss a just-created product and duplicate it.)
      const deterministicId = `propmaker_${spec.tier}`
      const existing = await stripe.products.retrieve(deterministicId).catch(() => null)

      if (existing) {
        productId = existing.id
        console.log(`product  ${spec.tier.padEnd(9)} reuse  ${productId}`)
      } else {
        const product = await stripe.products.create({
          id: deterministicId,
          name: spec.productName,
          description: spec.productDescription,
          metadata: { propmaker_tier: spec.tier },
        })
        productId = product.id
        console.log(`product  ${spec.tier.padEnd(9)} create ${productId}`)
      }
      productByTier.set(spec.tier, productId)
    }

    // currency_options is NOT returned unless expanded — without this the
    // reconcile below sees `undefined` every run and rewrites all 8 prices.
    const found = await stripe.prices.list({
      lookup_keys: [spec.lookupKey],
      limit: 1,
      expand: ['data.currency_options'],
    })
    const existingPrice = found.data[0]

    if (existingPrice) {
      const sameAmount = existingPrice.unit_amount === spec.unitAmount
      const sameShape = Boolean(existingPrice.recurring) === spec.recurring
      if (!sameAmount || !sameShape) {
        throw new Error(
          `Price ${spec.lookupKey} (${existingPrice.id}) already exists but does not match ` +
            `plans.ts: expected ${spec.unitAmount} ${spec.recurring ? 'monthly' : 'one-time'}, ` +
            `found ${existingPrice.unit_amount} ${existingPrice.recurring ? 'monthly' : 'one-time'}. ` +
            `Stripe prices are immutable — archive the old price (and free the lookup key) ` +
            `in the dashboard, then re-run.`,
        )
      }
      // unit_amount is immutable, but currency_options is not — reconcile it so
      // an existing USD-only price picks up (or corrects) its peso amount.
      const currentMxn = existingPrice.currency_options?.mxn?.unit_amount
      if (currentMxn !== spec.mxnAmount) {
        await stripe.prices.update(existingPrice.id, {
          currency_options: { mxn: { unit_amount: spec.mxnAmount } },
        })
        console.log(
          `price    ${spec.lookupKey.padEnd(14)} update ${existingPrice.id}  ` +
            `mxn ${currentMxn ?? 'none'} → ${spec.mxnAmount}`,
        )
      } else {
        console.log(`price    ${spec.lookupKey.padEnd(14)} reuse  ${existingPrice.id}`)
      }
      results.push({ envVar: spec.envVar, priceId: existingPrice.id, reused: true })
      continue
    }

    const price = await stripe.prices.create({
      product: productId,
      currency: 'usd',
      unit_amount: spec.unitAmount,
      currency_options: { mxn: { unit_amount: spec.mxnAmount } },
      lookup_key: spec.lookupKey,
      ...(spec.recurring ? { recurring: { interval: 'month' as const } } : {}),
      metadata: {
        credits: String(spec.credits),
        kind: spec.recurring ? 'plan' : 'pack',
      },
    })
    console.log(`price    ${spec.lookupKey.padEnd(14)} create ${price.id}`)
    results.push({ envVar: spec.envVar, priceId: price.id, reused: false })
  }

  console.log(`\n--- ${mode} env vars — paste these ---\n`)
  for (const r of results) console.log(`${r.envVar}=${r.priceId}`)
  console.log('')
}

main().catch((err) => {
  console.error('\n' + (err instanceof Error ? err.message : String(err)) + '\n')
  process.exit(1)
})
