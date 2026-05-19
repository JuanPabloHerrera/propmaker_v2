-- live_meeting_chat: in-meeting AI co-pilot conversation
CREATE TABLE live_meeting_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE live_meeting_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own live chat" ON live_meeting_chat
  FOR ALL USING (
    EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_id AND meetings.user_id = auth.uid())
  );

CREATE INDEX idx_live_meeting_chat_meeting_id ON live_meeting_chat(meeting_id);
