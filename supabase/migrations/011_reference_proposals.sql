-- 011_reference_proposals.sql
-- A library of the user's PAST proposals (uploaded files or proposals reused
-- from in-app), each stored as a Claude-extracted structured summary. The
-- proposal agent receives these summaries as cached context so it can mirror
-- the structure / tone / scope / pricing approach of similar prior projects —
-- while line items stay grounded in the live product catalog.
create table reference_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  summary text not null,
  source text not null check (source in ('uploaded', 'app_proposal')),
  source_proposal_id uuid references proposals(id) on delete set null,
  original_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reference_proposals_user_id on reference_proposals(user_id);

alter table reference_proposals enable row level security;

create policy "Users access own references" on reference_proposals
  for all using (auth.uid() = user_id);

create trigger reference_proposals_updated_at before update on reference_proposals
  for each row execute function update_updated_at();
