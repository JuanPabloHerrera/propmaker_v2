-- 017_meeting_documents.sql
-- Documents pivot: a meeting can now produce MULTIPLE documents — meeting
-- minutes, transcript summaries, and proposals — all edited in the same Tiptap
-- editor and shared/exported the same way. The existing `proposals` table
-- becomes `meeting_documents`:
--
--   - RENAME (not copy) so data, RLS policy, indexes, triggers, and incoming
--     FKs (proposal_shares.proposal_id, deck_exports.proposal_id,
--     reference_proposals.source_proposal_id) carry over untouched. Every
--     existing row becomes a doc_type='proposal' document and public share
--     slugs keep resolving.
--   - doc_type: 'minute' | 'summary' | 'proposal' (existing rows default to
--     'proposal'). Multiple rows per meeting were never blocked by schema
--     (only by the old upsert in code), so no constraint change is needed.
--   - title / language: per-document display title and output language.
--   - A temporary security-invoker compat VIEW named `proposals` keeps the
--     currently-deployed code working between applying this migration and
--     deploying the documents-hub build. Dropped in 020_cleanup.sql.
--
-- NOTE: run manually in the Supabase SQL editor, in the same sitting as the
-- documents-hub deploy.

alter table public.proposals rename to meeting_documents;

alter table public.meeting_documents
  add column if not exists doc_type text not null default 'proposal'
    check (doc_type in ('minute', 'summary', 'proposal')),
  add column if not exists title text,
  add column if not exists language text;

create index if not exists meeting_documents_meeting_idx
  on public.meeting_documents (meeting_id, doc_type, created_at desc);

-- Backfill display titles for pre-pivot proposals from their parent meeting.
update public.meeting_documents d
set title = coalesce(d.title, m.title)
from public.meetings m
where m.id = d.meeting_id and d.title is null;

-- Compat view: old deployed code reads/writes `proposals` until the new build
-- ships. security_invoker makes the underlying table's RLS apply to the caller,
-- and a single-table view is auto-updatable so PostgREST writes pass through.
create view public.proposals
  with (security_invoker = on)
  as select * from public.meeting_documents;
