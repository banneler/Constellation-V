-- Pathfinder contact discovery queue, evidence store, and review workflow.

create extension if not exists pgcrypto;

do $$ begin
  create type public.pathfinder_job_status as enum ('queued', 'running', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pathfinder_job_trigger as enum ('scheduled', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pathfinder_candidate_status as enum ('pending', 'approved', 'rejected', 'duplicate', 'stale');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pathfinder_role_family as enum ('technology', 'network');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pathfinder_email_status as enum ('public', 'inferred', 'unavailable');
exception when duplicate_object then null;
end $$;

alter table public.org_settings
  add column if not exists pathfinder_enabled boolean not null default false;

create table if not exists public.pathfinder_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id bigint not null references public.accounts(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  trigger public.pathfinder_job_trigger not null default 'manual',
  status public.pathfinder_job_status not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  candidates_found integer not null default 0 check (candidates_found >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pathfinder_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id bigint not null references public.accounts(id) on delete cascade,
  scan_job_id uuid references public.pathfinder_scan_jobs(id) on delete set null,
  identity_fingerprint text not null,
  first_name text not null,
  last_name text not null,
  title text not null,
  role_family public.pathfinder_role_family not null,
  location text,
  phone text,
  profile_url text,
  email_address text,
  email_status public.pathfinder_email_status not null default 'unavailable',
  email_pattern text,
  email_pattern_samples integer not null default 0 check (email_pattern_samples >= 0),
  email_confidence numeric(5,4) check (email_confidence is null or email_confidence between 0 and 1),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  confidence_reasons jsonb not null default '[]'::jsonb,
  status public.pathfinder_candidate_status not null default 'pending',
  crm_contact_id bigint references public.contacts(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  discovered_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pathfinder_candidate_identity_unique unique (account_id, identity_fingerprint),
  constraint pathfinder_candidate_email_shape check (
    (email_status = 'unavailable' and email_address is null)
    or (email_status in ('public', 'inferred') and nullif(trim(email_address), '') is not null)
  )
);

create table if not exists public.pathfinder_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.pathfinder_candidates(id) on delete cascade,
  source_url text not null,
  source_title text,
  source_type text not null default 'web',
  evidence_excerpt text not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint pathfinder_candidate_source_unique unique (candidate_id, source_url)
);

create index if not exists pathfinder_jobs_worker_idx
  on public.pathfinder_scan_jobs (status, created_at);
create index if not exists pathfinder_jobs_account_history_idx
  on public.pathfinder_scan_jobs (account_id, completed_at desc);
create unique index if not exists pathfinder_jobs_one_active_per_account_idx
  on public.pathfinder_scan_jobs (account_id)
  where status in ('queued', 'running');
create index if not exists pathfinder_candidates_owner_status_idx
  on public.pathfinder_candidates (user_id, status, discovered_at desc);
create index if not exists pathfinder_candidates_account_status_idx
  on public.pathfinder_candidates (account_id, status, confidence desc);
create index if not exists pathfinder_sources_candidate_idx
  on public.pathfinder_candidate_sources (candidate_id, observed_at desc);

drop trigger if exists set_pathfinder_scan_jobs_updated_at on public.pathfinder_scan_jobs;
create trigger set_pathfinder_scan_jobs_updated_at
before update on public.pathfinder_scan_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_pathfinder_candidates_updated_at on public.pathfinder_candidates;
create trigger set_pathfinder_candidates_updated_at
before update on public.pathfinder_candidates
for each row execute function public.set_updated_at();

create or replace function public.pathfinder_can_access_owner(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    auth.uid() = target_user_id
    or exists (
      select 1
      from public.user_quotas uq
      where uq.user_id = auth.uid()
        and coalesce(uq.is_manager, false) = true
        and uq.deactivated_at is null
    )
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true;
$$;

revoke all on function public.pathfinder_can_access_owner(uuid) from public;
grant execute on function public.pathfinder_can_access_owner(uuid) to authenticated;

alter table public.pathfinder_scan_jobs enable row level security;
alter table public.pathfinder_candidates enable row level security;
alter table public.pathfinder_candidate_sources enable row level security;

drop policy if exists pathfinder_jobs_select_accessible on public.pathfinder_scan_jobs;
create policy pathfinder_jobs_select_accessible
on public.pathfinder_scan_jobs for select to authenticated
using (public.pathfinder_can_access_owner(user_id));

drop policy if exists pathfinder_jobs_insert_accessible on public.pathfinder_scan_jobs;
create policy pathfinder_jobs_insert_accessible
on public.pathfinder_scan_jobs for insert to authenticated
with check (
  public.pathfinder_can_access_owner(user_id)
  and requested_by = auth.uid()
  and trigger = 'manual'
  and status = 'queued'
  and exists (
    select 1 from public.accounts a
    where a.id = account_id and a.user_id = user_id
  )
);

drop policy if exists pathfinder_candidates_select_accessible on public.pathfinder_candidates;
create policy pathfinder_candidates_select_accessible
on public.pathfinder_candidates for select to authenticated
using (public.pathfinder_can_access_owner(user_id));

drop policy if exists pathfinder_candidates_edit_accessible on public.pathfinder_candidates;
create policy pathfinder_candidates_edit_accessible
on public.pathfinder_candidates for update to authenticated
using (public.pathfinder_can_access_owner(user_id))
with check (public.pathfinder_can_access_owner(user_id));

drop policy if exists pathfinder_sources_select_accessible on public.pathfinder_candidate_sources;
create policy pathfinder_sources_select_accessible
on public.pathfinder_candidate_sources for select to authenticated
using (
  exists (
    select 1
    from public.pathfinder_candidates pc
    where pc.id = candidate_id
      and public.pathfinder_can_access_owner(pc.user_id)
  )
);

grant select on public.pathfinder_scan_jobs to authenticated;
grant insert on public.pathfinder_scan_jobs to authenticated;
grant select on public.pathfinder_candidates to authenticated;
grant select on public.pathfinder_candidate_sources to authenticated;
grant all on public.pathfinder_scan_jobs to service_role;
grant all on public.pathfinder_candidates to service_role;
grant all on public.pathfinder_candidate_sources to service_role;

revoke insert, delete on public.pathfinder_candidates from authenticated;
revoke update on public.pathfinder_candidates from authenticated;
grant update (
  first_name,
  last_name,
  title,
  role_family,
  location,
  phone,
  profile_url,
  email_address,
  email_status
) on public.pathfinder_candidates to authenticated;
revoke insert, update, delete on public.pathfinder_candidate_sources from authenticated;
revoke update, delete on public.pathfinder_scan_jobs from authenticated;

create or replace function public.approve_pathfinder_candidate(p_candidate_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  candidate public.pathfinder_candidates%rowtype;
  existing_contact_id bigint;
  approved_contact_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into candidate
  from public.pathfinder_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Pathfinder candidate not found';
  end if;
  if not public.pathfinder_can_access_owner(candidate.user_id) then
    raise exception 'Not authorized to review this candidate';
  end if;
  if candidate.status not in ('pending', 'duplicate') then
    raise exception 'Candidate has already been reviewed';
  end if;

  if nullif(trim(candidate.email_address), '') is not null then
    select c.id into existing_contact_id
    from public.contacts c
    where c.account_id = candidate.account_id
      and lower(trim(coalesce(c.email, ''))) = lower(trim(candidate.email_address))
    order by c.id
    limit 1;
  end if;

  if existing_contact_id is null then
    select c.id into existing_contact_id
    from public.contacts c
    where c.account_id = candidate.account_id
      and lower(trim(coalesce(c.first_name, ''))) = lower(trim(candidate.first_name))
      and lower(trim(coalesce(c.last_name, ''))) = lower(trim(candidate.last_name))
    order by c.id
    limit 1;
  end if;

  if existing_contact_id is not null then
    update public.pathfinder_candidates
    set status = 'duplicate',
        crm_contact_id = existing_contact_id,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = candidate.id;
    return existing_contact_id;
  end if;

  insert into public.contacts (
    first_name,
    last_name,
    email,
    phone,
    title,
    account_id,
    user_id,
    last_saved
  ) values (
    trim(candidate.first_name),
    trim(candidate.last_name),
    coalesce(candidate.email_address, ''),
    coalesce(candidate.phone, ''),
    trim(candidate.title),
    candidate.account_id,
    candidate.user_id,
    now()
  )
  returning id into approved_contact_id;

  update public.pathfinder_candidates
  set status = 'approved',
      crm_contact_id = approved_contact_id,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = candidate.id;

  return approved_contact_id;
end;
$$;

create or replace function public.reject_pathfinder_candidate(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  candidate public.pathfinder_candidates%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into candidate
  from public.pathfinder_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Pathfinder candidate not found';
  end if;
  if not public.pathfinder_can_access_owner(candidate.user_id) then
    raise exception 'Not authorized to review this candidate';
  end if;
  if candidate.status <> 'pending' then
    raise exception 'Only pending candidates may be rejected';
  end if;

  update public.pathfinder_candidates
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = candidate.id;
end;
$$;

revoke all on function public.approve_pathfinder_candidate(uuid) from public;
revoke all on function public.reject_pathfinder_candidate(uuid) from public;
grant execute on function public.approve_pathfinder_candidate(uuid) to authenticated;
grant execute on function public.reject_pathfinder_candidate(uuid) to authenticated;

comment on table public.pathfinder_scan_jobs is
  'Account-scoped scheduled and user-requested Pathfinder discovery work.';
comment on table public.pathfinder_candidates is
  'Evidence-backed contact candidates awaiting human review before CRM promotion.';
comment on table public.pathfinder_candidate_sources is
  'Public-source provenance for Pathfinder candidates.';
