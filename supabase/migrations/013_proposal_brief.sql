-- 013_proposal_brief.sql
-- Pre-proposal synthesis. After the post-meeting Q&A, PropMaker distills every
-- input (browser + recall transcript, consultant notes, Q&A, in-meeting
-- co-pilot chat, product catalog, reference proposals, and the pre-meeting
-- context/attendee/client metadata) into a single prioritized "proposal brief".
-- The consultant reviews and edits it on the /brief screen before the proposal
-- is generated, so the proposal is organized into clear, prioritized, actionable
-- items. Stored as jsonb so the shape (see ProposalBrief in types/index.ts) can
-- evolve without a migration.
--
-- `meetings` is already in the supabase_realtime publication, so adding a column
-- needs no publication change.
alter table public.meetings
  add column if not exists proposal_brief jsonb;
