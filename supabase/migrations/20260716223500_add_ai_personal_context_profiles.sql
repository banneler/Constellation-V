-- RAG memory pipeline tables for AI feedback and per-user prompt synthesis.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.personal_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  response text not null,
  rating integer check (rating is null or rating between 1 and 5),
  feedback text,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.personal_context is
  'Raw AI prompt/response feedback used to synthesize each user''s dynamic AI profile.';
comment on column public.personal_context.processed is
  'True after a synthesis job has incorporated this feedback into user_ai_profiles.';

create index if not exists personal_context_user_processed_created_idx
  on public.personal_context (user_id, processed, created_at desc);

create index if not exists personal_context_processed_created_idx
  on public.personal_context (processed, created_at desc);

drop trigger if exists set_personal_context_updated_at on public.personal_context;
create trigger set_personal_context_updated_at
before update on public.personal_context
for each row
execute function public.set_updated_at();

alter table public.personal_context enable row level security;

drop policy if exists "Users can read their own AI feedback" on public.personal_context;
create policy "Users can read their own AI feedback"
on public.personal_context
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their own AI feedback" on public.personal_context;
create policy "Users can create their own AI feedback"
on public.personal_context
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own AI feedback" on public.personal_context;
create policy "Users can update their own AI feedback"
on public.personal_context
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.user_ai_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dynamic_prompt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_ai_profiles is
  'Per-user synthesized AI system prompt generated from Personal Context feedback.';

drop trigger if exists set_user_ai_profiles_updated_at on public.user_ai_profiles;
create trigger set_user_ai_profiles_updated_at
before update on public.user_ai_profiles
for each row
execute function public.set_updated_at();

alter table public.user_ai_profiles enable row level security;

drop policy if exists "Users can read their own AI profile" on public.user_ai_profiles;
create policy "Users can read their own AI profile"
on public.user_ai_profiles
for select
to authenticated
using (user_id = auth.uid());
