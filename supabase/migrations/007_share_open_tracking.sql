-- 007_share_open_tracking.sql
-- Tracks the first time a public proposal link is opened so the share
-- screen can show "Opened" without needing per-recipient pixels.
-- Uses a single column on proposals (proposal-level, not per-share)
-- because we don't distinguish recipients without unique email links.

alter table public.proposals
  add column if not exists first_opened_at timestamptz;

alter table public.proposals
  add column if not exists open_count integer not null default 0;
