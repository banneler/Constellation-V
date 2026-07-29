-- Allow-list email domains for public signup (before-user-created Auth hook).
-- Stock onboarding: insert each customer's approved domains into signup_email_domains.
-- Fail-closed: if no allow rows exist, signups are rejected.

do $$ begin
  create type public.signup_email_domain_type as enum ('allow', 'deny');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.signup_email_domains (
  id serial primary key,
  domain text not null,
  type public.signup_email_domain_type not null default 'allow',
  reason text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signup_email_domains_domain_unique unique (domain)
);

create or replace function public.update_signup_email_domains_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_signup_email_domains_set_updated_at on public.signup_email_domains;
create trigger trg_signup_email_domains_set_updated_at
before update on public.signup_email_domains
for each row
execute function public.update_signup_email_domains_updated_at();

alter table public.signup_email_domains enable row level security;

-- Managers can maintain the allow-list in-app later if desired.
drop policy if exists signup_email_domains_manager_all on public.signup_email_domains;
create policy signup_email_domains_manager_all
  on public.signup_email_domains
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_quotas uq
      where uq.user_id = auth.uid()
        and coalesce(uq.is_manager, false) = true
        and uq.deactivated_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.user_quotas uq
      where uq.user_id = auth.uid()
        and coalesce(uq.is_manager, false) = true
        and uq.deactivated_at is null
    )
  );

create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_email text;
  email_domain text;
  allow_count int;
  is_allowed int;
  is_denied int;
begin
  signup_email := lower(coalesce(event->'user'->>'email', ''));
  email_domain := split_part(signup_email, '@', 2);

  if signup_email = '' or email_domain = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'A valid work email is required to sign up.',
        'http_code', 400
      )
    );
  end if;

  select count(*) into is_denied
  from public.signup_email_domains d
  where d.type = 'deny' and lower(d.domain) = email_domain;

  if is_denied > 0 then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Signups from this email domain are not allowed.',
        'http_code', 403
      )
    );
  end if;

  select count(*) into allow_count
  from public.signup_email_domains d
  where d.type = 'allow';

  -- Fail closed when allow-list is empty (safe default with autoconfirm).
  if allow_count = 0 then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Signups are not open for this Constellation instance yet.',
        'http_code', 403
      )
    );
  end if;

  select count(*) into is_allowed
  from public.signup_email_domains d
  where d.type = 'allow' and lower(d.domain) = email_domain;

  if is_allowed > 0 then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Only approved company email domains can create accounts for this Constellation instance.',
      'http_code', 403
    )
  );
end;
$$;

grant execute on function public.hook_restrict_signup_by_email_domain(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_by_email_domain(jsonb) from authenticated, anon, public;

grant select on table public.signup_email_domains to supabase_auth_admin;
