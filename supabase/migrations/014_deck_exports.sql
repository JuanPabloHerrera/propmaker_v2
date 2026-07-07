-- 014_deck_exports.sql
-- Async, high-fidelity PPTX export: Claude builds the deck with its own `pptx`
-- Agent Skill (+ our custom pptx-proposal-deck skill) inside a code-execution
-- container, reproducing the uploaded brand template on every slide. That run
-- takes minutes, so the export is a background job: the start route inserts a
-- deck_exports row and kicks off the build; the finished .pptx lands in the
-- private "generated-decks" bucket; the client watches the row via Realtime.
--
-- Adds:
--   - deck_exports: one row per export request (status + result pointer)
--   - a PRIVATE storage bucket "generated-decks" (per-user folder RLS)
--   - Realtime on deck_exports so the browser is notified when a deck is ready
--
-- NOTE: run this manually in the Supabase SQL editor (migrations are not applied
-- automatically for this project). After running, verify Realtime is on for
-- public.deck_exports (Database → Replication, or the publication statement below).

-- 1. Job table.
create table if not exists public.deck_exports (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- reference_proposals.id of the brand template used (null = no template).
  template_ref_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  -- which path produced the file: 'skill' (Claude pptx skill) or 'fast' (pptxgenjs fallback).
  engine text not null default 'skill' check (engine in ('skill', 'fast')),
  error text,
  -- path in the generated-decks bucket once succeeded: {user_id}/{job_id}.pptx
  file_path text,
  filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deck_exports_proposal_idx on public.deck_exports (proposal_id);
create index if not exists deck_exports_user_created_idx on public.deck_exports (user_id, created_at desc);

alter table public.deck_exports enable row level security;

drop policy if exists "Users read own deck exports" on public.deck_exports;
drop policy if exists "Users insert own deck exports" on public.deck_exports;
drop policy if exists "Users update own deck exports" on public.deck_exports;

-- Reads (incl. Realtime) are owner-only. Inserts/updates from the export worker
-- use the service-role key (bypasses RLS); the insert/update policies below let
-- the owning user create/mutate their own rows directly too.
create policy "Users read own deck exports"
  on public.deck_exports for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own deck exports"
  on public.deck_exports for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own deck exports"
  on public.deck_exports for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Private bucket for the generated decks (idempotent). 50 MB — reproduced
--    brand decks carry embedded images and run larger than the templates.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-decks',
  'generated-decks',
  false,
  52428800,
  array['application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. Storage RLS — owner-only, namespaced under a {user_id}/... folder. The
--    worker writes via the service role (bypasses RLS); the read policy lets the
--    owner download their finished deck through the app's authenticated client.
drop policy if exists "Users read own generated decks" on storage.objects;
drop policy if exists "Users insert own generated decks" on storage.objects;
drop policy if exists "Users update own generated decks" on storage.objects;
drop policy if exists "Users delete own generated decks" on storage.objects;

create policy "Users read own generated decks"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generated-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users insert own generated decks"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'generated-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own generated decks"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'generated-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'generated-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own generated decks"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'generated-decks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Realtime — let the browser subscribe to its own deck_exports rows so the
--    UI reveals the deck the moment the worker flips status to 'succeeded'.
--    (No-op if the table is already in the publication.)
do $$
begin
  alter publication supabase_realtime add table public.deck_exports;
exception
  when duplicate_object then null;
  when undefined_object then null; -- publication not present in this environment
end $$;
