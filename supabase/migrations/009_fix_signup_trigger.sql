-- 009_fix_signup_trigger.sql
-- Fix signup 500 ("Database error saving new user").
--
-- create_user_profile() (migration 005) ran SECURITY DEFINER but with no
-- search_path of its own. GoTrue inserts into auth.users as supabase_auth_admin,
-- whose role search_path is `auth`, so the unqualified `user_profiles` reference
-- resolved against the auth schema, didn't exist, threw, and rolled back the
-- auth.users insert — surfacing as a 500 on every new signup. (Existing accounts
-- worked because 005's backfill ran as postgres, whose search_path includes public.)
--
-- Pin search_path, schema-qualify the table, and make profile creation non-fatal
-- to signup. CREATE OR REPLACE is enough; the on_auth_user_created trigger already
-- points at this function.
create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  raise warning 'create_user_profile failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;
