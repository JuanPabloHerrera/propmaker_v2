-- 010_live_partial.sql
-- Real-time (word-by-word) conferencing transcript. The Recall bot streams
-- partial transcripts (transcript.partial_data); we stash the current partial
-- here and the live page renders it as the interim line, then clears it when the
-- finalized utterance (transcript.data) is inserted as a segment.
--
-- `meetings` is already in the supabase_realtime publication, so UPDATEs to this
-- new column stream to the client automatically (no publication change needed).
alter table public.meetings
  add column if not exists live_partial text;
