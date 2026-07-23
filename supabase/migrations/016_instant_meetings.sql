-- 016_instant_meetings.sql
-- Instant-join pivot: /meetings/new becomes a bare mode picker (local mic vs
-- online link) with no pre-meeting form and no scheduling. The meeting's title,
-- client company, attendees, context summary, and dominant language are now
-- auto-extracted from the transcript after the meeting ends.
--
-- Adds:
--   - meetings.language: dominant transcript language (ISO code, e.g. 'es'),
--     detected post-meeting; generated documents are written in this language.
--   - meetings.metadata_extracted_at: idempotency guard so the extraction Claude
--     call runs once even though it is triggered from multiple paths (meeting
--     PATCH on completion, Recall transcript.done webhook, processing fallback).
--
-- Deprecated (code stops writing; columns kept so existing rows stay intact,
-- dropped later in 020_cleanup.sql): scheduled_at, selected_categories,
-- attached_product_ids, detected_product_ids, client_value, proposal_brief.
-- The deal_status check keeps 'upcoming' so legacy scheduled rows stay valid.
--
-- NOTE: run manually in the Supabase SQL editor (migrations are not applied
-- automatically for this project).

alter table public.meetings
  alter column title set default 'Untitled meeting';

alter table public.meetings
  add column if not exists language text,
  add column if not exists metadata_extracted_at timestamptz;

comment on column public.meetings.language is
  'Dominant transcript language (ISO code); documents are generated in it.';
comment on column public.meetings.metadata_extracted_at is
  'Set when post-meeting metadata extraction has run (idempotency guard).';

comment on column public.meetings.scheduled_at is 'DEPRECATED — scheduling removed in the instant-join pivot.';
comment on column public.meetings.selected_categories is 'DEPRECATED — pre-meeting form removed; catalog defaults to all active products.';
comment on column public.meetings.attached_product_ids is 'DEPRECATED — pre-meeting form removed.';
comment on column public.meetings.detected_product_ids is 'DEPRECATED — detection screen removed with post-meeting Q&A.';
comment on column public.meetings.client_value is 'DEPRECATED — pre-meeting form removed.';
comment on column public.meetings.proposal_brief is 'DEPRECATED — brief step removed; documents are generated single-pass.';
