-- Granola-style pivot: products catalog, meeting notes pad, transcript source tagging.

-- products: user-managed catalog of offerings
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price_amount NUMERIC(12,2),
  price_unit TEXT,
  currency TEXT NOT NULL DEFAULT 'MXN',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_user_category ON products(user_id, category);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own products" ON products
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- meetings: additive columns for capture mode, notes pad, and category selection
ALTER TABLE meetings
  ADD COLUMN selected_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN notes_json JSONB,
  ADD COLUMN capture_mode TEXT NOT NULL DEFAULT 'browser';

-- transcript source tagging so the proposal agent can distinguish primary (browser)
-- from fallback (recall) audio.
ALTER TABLE transcript_segments ADD COLUMN source TEXT;

UPDATE transcript_segments
SET source = 'recall'
WHERE meeting_id IN (SELECT id FROM meetings WHERE recall_bot_id IS NOT NULL);

UPDATE transcript_segments SET source = 'browser' WHERE source IS NULL;

ALTER TABLE transcript_segments ALTER COLUMN source SET NOT NULL;
ALTER TABLE transcript_segments ALTER COLUMN source SET DEFAULT 'browser';

CREATE INDEX idx_transcript_segments_meeting_source
  ON transcript_segments(meeting_id, source);
