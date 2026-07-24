-- 022_credits.sql
-- Credits system: each user has a balance; generating a document costs 97
-- credits (DOCUMENT_CREDIT_COST in lib/billing/plans.ts). Balances live in a
-- dedicated table (NOT user_profiles — its FOR ALL RLS policy would make a
-- balance column client-writable). All writes go through SECURITY DEFINER
-- RPCs that only the service role may execute; clients get read-only access.
--
-- Apply AFTER 021_notes_doc_type.sql, BEFORE deploying the credits code.
-- Safe to apply ahead of the deploy: old code never touches these tables.

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  plan_id TEXT,                -- key into lib/billing/plans.ts PLANS; NULL = free
  subscription_status TEXT,    -- 'active' | 'past_due' | 'canceled' | NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('grant', 'purchase', 'subscription_grant', 'spend', 'refund')),
  amount INT NOT NULL,                 -- signed: negative for spend
  balance_after INT NOT NULL,
  reason TEXT,
  reference_id UUID,                   -- e.g. meeting_documents.id for spends
  stripe_event_id TEXT,                -- webhook idempotency key
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One ledger row per Stripe event, ever — makes webhook retries no-ops.
CREATE UNIQUE INDEX idx_credit_tx_stripe_event
  ON credit_transactions (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX idx_credit_tx_user_created
  ON credit_transactions (user_id, created_at DESC);

-- ── RLS: read-own only; NO write policies (service-role RPCs only) ─────────

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Atomic check-and-decrement. Raises INSUFFICIENT_CREDITS when the balance
-- can't cover the spend (the CHECK constraint is the last line of defense).
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT,
  p_ref UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE user_credits
     SET balance = balance - p_amount
   WHERE user_id = p_user_id
     AND balance >= p_amount
  RETURNING balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO credit_transactions (user_id, type, amount, balance_after, reason, reference_id)
  VALUES (p_user_id, 'spend', -p_amount, v_balance, p_reason, p_ref);

  RETURN v_balance;
END;
$$;

-- Grant credits (signup, purchase, subscription renewal, refund).
-- Idempotent per Stripe event: if p_stripe_event_id was already recorded the
-- call is a no-op returning the current balance — covers webhook retries; the
-- unique_violation handler covers two retries racing each other.
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id UUID,
  p_amount INT,
  p_type TEXT,
  p_reason TEXT,
  p_ref UUID DEFAULT NULL,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF p_stripe_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM credit_transactions WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  INSERT INTO user_credits (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + EXCLUDED.balance
  RETURNING balance INTO v_balance;

  INSERT INTO credit_transactions
    (user_id, type, amount, balance_after, reason, reference_id, stripe_event_id, metadata)
  VALUES
    (p_user_id, p_type, p_amount, v_balance, p_reason, p_ref, p_stripe_event_id, p_metadata);

  RETURN v_balance;

EXCEPTION WHEN unique_violation THEN
  -- Concurrent webhook retry inserted the same stripe_event_id first.
  SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id;
  RETURN COALESCE(v_balance, 0);
END;
$$;

-- Service role only — clients must never move credits directly.
REVOKE EXECUTE ON FUNCTION public.spend_credits(UUID, INT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_credits(UUID, INT, TEXT, TEXT, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

-- ── Signup trigger: profile + 200-credit grant ─────────────────────────────
-- Keeps 009's hardening (pinned search_path, schema-qualified, non-fatal).
-- The 200 here mirrors SIGNUP_GRANT in lib/billing/plans.ts — keep in sync.

CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 200)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, reason)
  VALUES (NEW.id, 'grant', 200, 200, 'signup_grant');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_user_profile failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── Backfill: 200 credits for every existing user ──────────────────────────

INSERT INTO user_credits (user_id, balance)
SELECT id, 200 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO credit_transactions (user_id, type, amount, balance_after, reason)
SELECT uc.user_id, 'grant', 200, 200, 'backfill_signup_grant'
FROM user_credits uc
WHERE NOT EXISTS (
  SELECT 1 FROM credit_transactions t WHERE t.user_id = uc.user_id
);
