-- 018_reference_full_text.sql
-- Reference matching: proposals are now generated single-pass against the single
-- MOST SIMILAR past reference. The ≤350-word summary is enough to pick the match
-- but not to mirror scope/timeline/packaging accurately, so the extracted text of
-- each reference is now stored at upload time (capped at 40k chars in code).
--
-- Legacy rows: source='uploaded' files were never persisted, so their full_text
-- stays null (matching and injection fall back to summary — the references UI
-- suggests re-uploading). source='app_proposal' rows can be backfilled from the
-- source document's content_json.
--
-- NOTE: run manually in the Supabase SQL editor.

alter table public.reference_proposals
  add column if not exists full_text text;

comment on column public.reference_proposals.full_text is
  'Extracted document text (≤40k chars) captured at upload; null for legacy uploads.';
