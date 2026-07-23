-- 020_cleanup.sql
-- Final cleanup for the instant-join + documents pivot. Run ONLY after the
-- documents-hub build is deployed and verified in production:
--   1. /meetings/new joins instantly and the documents hub generates all three
--      document types.
--   2. Legacy public share slugs still resolve at /p/[slug].
--   3. Exports (pptx/docx/pdf) queue and finish against deck_exports.
--
-- Drops the migration-017 compat view, the post-meeting Q&A table, and the
-- deprecated meetings columns that nothing reads anymore.
--
-- NOTE: run manually in the Supabase SQL editor.

drop view if exists public.proposals;

drop table if exists public.post_meeting_chat;

alter table public.meetings
  drop column if exists scheduled_at,
  drop column if exists selected_categories,
  drop column if exists attached_product_ids,
  drop column if exists detected_product_ids,
  drop column if exists client_value,
  drop column if exists proposal_brief;
