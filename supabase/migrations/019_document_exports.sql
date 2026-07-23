-- 019_document_exports.sql
-- Export generalization: every document type (minute / summary / proposal) can
-- now export to PPTX, Word (.docx), or PDF — all built by the Claude agent
-- bridge (code-execution container + document skills). The deck_exports job
-- table generalizes in place:
--
--   - proposal_id → document_id (FK already points at meeting_documents after
--     017's table rename; renaming the column keeps the FK).
--   - format: 'pptx' | 'docx' | 'pdf' (existing rows default to 'pptx').
--   - The private generated-decks bucket now also accepts docx and pdf; files
--     land at {user_id}/{job_id}.{ext}. Bucket and policies are otherwise
--     unchanged (renaming a bucket would mean re-creating four policies).
--
-- The 'fast' engine remains meaningful only for format='pptx' (pptxgenjs
-- fallback); docx/pdf jobs fail cleanly when the skill run fails.
--
-- NOTE: run manually in the Supabase SQL editor, in the same sitting as the
-- export-generalization deploy. Afterwards verify public.deck_exports is still
-- in the supabase_realtime publication (Database → Replication).

alter table public.deck_exports rename column proposal_id to document_id;

alter table public.deck_exports
  add column if not exists format text not null default 'pptx'
    check (format in ('pptx', 'docx', 'pdf'));

alter index if exists deck_exports_proposal_idx rename to deck_exports_document_idx;

update storage.buckets
set allowed_mime_types = array[
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf'
]
where id = 'generated-decks';
