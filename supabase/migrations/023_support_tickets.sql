-- 023_support_tickets.sql
-- Persist support tickets submitted from /support.
--
-- The row is written BEFORE the email is attempted, so a ticket survives an
-- outage at the email provider — losing a customer's bug report because Resend
-- was down is worse than a duplicate. `email_sent` records whether delivery
-- actually succeeded, so undelivered tickets can be found with a plain query.
--
-- The table also serves as the rate limiter: the API counts a user's recent
-- rows instead of keeping in-memory state, which would be useless on
-- serverless where every request may hit a different instance.
--
-- Apply AFTER 022_credits.sql. Safe to apply ahead of the deploy: old code
-- never touches this table.

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,                  -- snapshot: the account email may change later
  category TEXT NOT NULL,      -- 'Bug' | 'Billing' | 'Feature request' | 'Question' | 'Other'
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  page TEXT,                   -- where the user was before opening /support
  plan_id TEXT,                -- account context at submission time
  balance INT,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Serves the rate-limit lookup (recent rows for one user) and the common
-- "newest tickets" read.
CREATE INDEX support_tickets_user_created_idx
  ON support_tickets (user_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Users may read their own tickets (so a "your requests" view can be added
-- later) but never write: every insert goes through the API with the service
-- role, which is what stamps the trustworthy plan/balance context. A client
-- INSERT policy would let a user forge that context.

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select_own" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);
