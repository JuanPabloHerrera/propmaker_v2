-- 021: allow the 'notes' document type (AI-polished document generated from
-- ONLY the consultant's own meeting notes — no transcript).
--
-- ⚠️ Apply this in the Supabase SQL editor BEFORE deploying the code that
-- offers the "Notes document" generator card; inserts with doc_type='notes'
-- violate the old check constraint otherwise.

alter table public.meeting_documents
  drop constraint if exists meeting_documents_doc_type_check;

alter table public.meeting_documents
  add constraint meeting_documents_doc_type_check
    check (doc_type in ('minute', 'summary', 'proposal', 'notes'));
