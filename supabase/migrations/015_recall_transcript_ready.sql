-- 015_recall_transcript_ready.sql
-- Readiness signal for the Recall bot transcript. Online meetings depend on the
-- Recall webhook delivering the finalized transcript (transcript.done); the
-- Processing screen must wait for that before advancing to Q&A/proposal so
-- generation always sees the full transcript rather than an empty one.
--
-- We can't reuse `status='completed'` because the `bot.done`/`bot.status_change`
-- branch sets that when the call ends, which can be *before* transcript.done
-- delivers the actual transcript. This boolean is only flipped once the
-- authoritative recall segments have been persisted (webhook transcript.done or
-- the dev-only /sync pull).
--
-- `meetings` is already in the supabase_realtime publication, so UPDATEs to this
-- new column stream to the client automatically (no publication change needed).
alter table public.meetings
  add column if not exists recall_transcript_ready boolean not null default false;
