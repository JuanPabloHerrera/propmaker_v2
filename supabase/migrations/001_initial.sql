-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL DEFAULT 'consulting',
  recall_bot_id TEXT,
  meeting_url TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- transcript_segments (Realtime enabled)
CREATE TABLE transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  speaker TEXT,
  text TEXT NOT NULL,
  start_time FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- suggestions (Realtime enabled)
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- post_meeting_chat
CREATE TABLE post_meeting_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- proposals
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_json JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER proposals_updated_at BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_meeting_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- meetings RLS
CREATE POLICY "Users access own meetings" ON meetings
  FOR ALL USING (auth.uid() = user_id);

-- transcript_segments RLS (via meeting ownership)
CREATE POLICY "Users access own transcripts" ON transcript_segments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_id AND meetings.user_id = auth.uid())
  );

-- Allow service role to insert transcript segments (for webhook handler)
CREATE POLICY "Service role insert transcripts" ON transcript_segments
  FOR INSERT WITH CHECK (true);

-- suggestions RLS
CREATE POLICY "Users access own suggestions" ON suggestions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_id AND meetings.user_id = auth.uid())
  );

CREATE POLICY "Service role insert suggestions" ON suggestions
  FOR INSERT WITH CHECK (true);

-- post_meeting_chat RLS
CREATE POLICY "Users access own chat" ON post_meeting_chat
  FOR ALL USING (
    EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_id AND meetings.user_id = auth.uid())
  );

-- proposals RLS
CREATE POLICY "Users access own proposals" ON proposals
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_transcript_segments_meeting_id ON transcript_segments(meeting_id);
CREATE INDEX idx_suggestions_meeting_id ON suggestions(meeting_id);
CREATE INDEX idx_post_meeting_chat_meeting_id ON post_meeting_chat(meeting_id);
CREATE INDEX idx_proposals_meeting_id ON proposals(meeting_id);
