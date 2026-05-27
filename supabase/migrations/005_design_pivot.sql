-- 005_design_pivot.sql
-- Adds the data the redesigned UI needs:
--   - user_profiles for onboarding, brand voice, signature, brand colors
--   - meetings: attendees, context summary, client metadata, deal status, attached/detected products
--   - proposals: public sharing slug + proposal_shares ledger

-- ─── user_profiles ─────────────────────────────────────────────
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  tagline TEXT,
  website TEXT,
  industry TEXT,
  voice_tones TEXT[] NOT NULL DEFAULT '{}',
  tone_prompt TEXT,
  signature_name TEXT,
  signature_title TEXT,
  brand_colors TEXT[] NOT NULL DEFAULT '{}',
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create a profile row on auth signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Backfill rows for existing users
INSERT INTO user_profiles (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles);

-- ─── meetings: additive columns ───────────────────────────────
ALTER TABLE meetings
  ADD COLUMN attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN context_summary TEXT,
  ADD COLUMN client_company TEXT,
  ADD COLUMN client_value NUMERIC(12,2),
  ADD COLUMN attached_product_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN detected_product_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN deal_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (deal_status IN ('draft','proposal_sent','won','lost','upcoming'));

CREATE INDEX idx_meetings_user_deal_status ON meetings(user_id, deal_status);
CREATE INDEX idx_meetings_user_scheduled ON meetings(user_id, scheduled_at);

-- ─── proposals: public sharing ────────────────────────────────
ALTER TABLE proposals
  ADD COLUMN public_slug TEXT UNIQUE,
  ADD COLUMN shared_at TIMESTAMPTZ;

CREATE TABLE proposal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  message_body TEXT
);

CREATE INDEX idx_proposal_shares_proposal_id ON proposal_shares(proposal_id);

ALTER TABLE proposal_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own proposal shares" ON proposal_shares
  FOR ALL USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = proposal_shares.proposal_id AND p.user_id = auth.uid()
  ));

-- Public read of a shared proposal — slug-based, no auth required
CREATE POLICY "Public read shared proposals" ON proposals
  FOR SELECT USING (public_slug IS NOT NULL);
