-- Add live_meeting_chat to the Realtime publication.
-- It was created in 003 but never added to supabase_realtime in 002, unlike the
-- other live tables (transcript_segments, suggestions, meetings). Idempotent so
-- it's safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_meeting_chat'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_meeting_chat;
  END IF;
END $$;
