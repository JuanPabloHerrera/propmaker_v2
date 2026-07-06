-- 012_reference_decks.sql
-- Lets users upload a PowerPoint (.pptx) into references as a *style template*.
-- The exported proposal deck reuses the template's colors, fonts, and background.
--
-- Adds:
--   - a PRIVATE storage bucket "reference-decks" (per-user folder RLS)
--   - reference_proposals: allow source='pptx_template', + file_path + theme_json
--
-- NOTE: run this manually in the Supabase SQL editor (migrations are not applied
-- automatically for this project).

-- 1. reference_proposals: allow the new source + store the file path & extracted theme.
alter table public.reference_proposals
  drop constraint if exists reference_proposals_source_check;

alter table public.reference_proposals
  add constraint reference_proposals_source_check
  check (source in ('uploaded', 'app_proposal', 'pptx_template'));

alter table public.reference_proposals
  add column if not exists file_path text,
  add column if not exists theme_json jsonb;

-- 2. Private bucket for the uploaded template decks (idempotent).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reference-decks',
  'reference-decks',
  false, -- private: read via the authenticated owner / signed download only
  26214400, -- 25 MB
  array['application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. Storage RLS — owner-only, namespaced under a {user_id}/... folder.
drop policy if exists "Users can read own reference decks" on storage.objects;
drop policy if exists "Users can upload own reference decks" on storage.objects;
drop policy if exists "Users can update own reference decks" on storage.objects;
drop policy if exists "Users can delete own reference decks" on storage.objects;

create policy "Users can read own reference decks"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'reference-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload own reference decks"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reference-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own reference decks"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'reference-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'reference-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own reference decks"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reference-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
