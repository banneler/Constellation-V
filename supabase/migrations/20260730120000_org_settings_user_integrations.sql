-- Org-level email/calendar integration toggle + per-user Nylas connection metadata.
-- One-tenant-per-deploy: org_settings is a singleton row (id = 1).

do $$ begin
  create type public.integration_provider as enum ('google', 'microsoft');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.integration_status as enum ('connected', 'invalid', 'revoked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.org_settings (
  id integer primary key default 1 check (id = 1),
  email_calendar_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id) on delete set null
);

insert into public.org_settings (id, email_calendar_enabled)
values (1, false)
on conflict (id) do nothing;

create or replace function public.update_org_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_org_settings_set_updated_at on public.org_settings;
create trigger trg_org_settings_set_updated_at
before update on public.org_settings
for each row
execute function public.update_org_settings_updated_at();

alter table public.org_settings enable row level security;

drop policy if exists org_settings_select_authenticated on public.org_settings;
create policy org_settings_select_authenticated
  on public.org_settings
  for select
  to authenticated
  using (true);

drop policy if exists org_settings_manager_write on public.org_settings;
create policy org_settings_manager_write
  on public.org_settings
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
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  )
  with check (
    exists (
      select 1
      from public.user_quotas uq
      where uq.user_id = auth.uid()
        and coalesce(uq.is_manager, false) = true
        and uq.deactivated_at is null
    )
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.integration_provider not null,
  nylas_grant_id text not null,
  email text null,
  status public.integration_status not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_integrations_user_unique unique (user_id)
);

create index if not exists user_integrations_grant_idx
  on public.user_integrations (nylas_grant_id);

create or replace function public.update_user_integrations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_integrations_set_updated_at on public.user_integrations;
create trigger trg_user_integrations_set_updated_at
before update on public.user_integrations
for each row
execute function public.update_user_integrations_updated_at();

alter table public.user_integrations enable row level security;

drop policy if exists user_integrations_select_own_or_manager on public.user_integrations;
create policy user_integrations_select_own_or_manager
  on public.user_integrations
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.user_quotas uq
      where uq.user_id = auth.uid()
        and coalesce(uq.is_manager, false) = true
        and uq.deactivated_at is null
    )
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );

drop policy if exists user_integrations_insert_own on public.user_integrations;
create policy user_integrations_insert_own
  on public.user_integrations
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_integrations_update_own on public.user_integrations;
create policy user_integrations_update_own
  on public.user_integrations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_integrations_delete_own on public.user_integrations;
create policy user_integrations_delete_own
  on public.user_integrations
  for delete
  to authenticated
  using (user_id = auth.uid());
