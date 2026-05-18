-- Enable Supabase Realtime on live-data tables
ALTER PUBLICATION supabase_realtime ADD TABLE transcript_segments;
ALTER PUBLICATION supabase_realtime ADD TABLE suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
