-- 006_user_logo.sql
-- Adds logo_url to user_profiles, a Supabase Storage bucket
-- "user-logos" with RLS (anyone reads, only the owner writes their
-- own folder), and a public-read policy on user_profiles that
-- exposes signature + brand fields to anon clients viewing a shared
-- proposal (so /p/[slug] can render the author's signature + logo).

alter table public.user_profiles
  add column if not exists logo_url text;

-- Public read of user_profiles is gated on the user having at least
-- one shared proposal. This lets the public proposal view render the
-- author's signature, company name, and logo without exposing
-- profiles for users who never shared.
drop policy if exists "Public read profiles of users with shared proposals" on public.user_profiles;
create policy "Public read profiles of users with shared proposals"
  on public.user_profiles for select
  using (
    exists (
      select 1 from public.proposals
      where proposals.user_id = user_profiles.user_id
        and proposals.public_slug is not null
    )
  );

-- Create the bucket (idempotent).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-logos',
  'user-logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop existing policies if re-running.
drop policy if exists "Anyone can read user logos" on storage.objects;
drop policy if exists "Users can upload own logo" on storage.objects;
drop policy if exists "Users can update own logo" on storage.objects;
drop policy if exists "Users can delete own logo" on storage.objects;

create policy "Anyone can read user logos"
  on storage.objects for select
  using (bucket_id = 'user-logos');

create policy "Users can upload own logo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own logo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own logo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
