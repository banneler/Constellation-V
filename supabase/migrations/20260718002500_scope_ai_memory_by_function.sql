-- Scope AI feedback and synthesized prompts by function so distinct AI surfaces
-- do not blend incompatible voice or structure preferences.

alter table public.personal_context
  add column if not exists function_id text not null default 'legacy-general';

update public.personal_context
set function_id = case substring(prompt from '"function_id"\s*:\s*"([^"]+)"')
  when 'get-gemini-suggestion' then 'cognito-outreach'
  when 'generate-custom-suggestion' then 'cognito-outreach'
  when 'generate-prospect-email' then 'contacts-email'
  when 'get-activity-insight' then 'contacts-activity-insight'
  when 'generate-social-post' then 'social-post'
  when 'refine-social-post' then 'social-post-refine'
  when 'generate-sequence-steps' then 'sequence-generation'
  when 'get-account-briefing' then 'account-briefing'
  when 'get-daily-briefing' then 'daily-briefing'
  else coalesce(substring(prompt from '"function_id"\s*:\s*"([^"]+)"'), function_id, 'legacy-general')
end
where function_id = 'legacy-general'
  and substring(prompt from '"function_id"\s*:\s*"([^"]+)"') is not null;

comment on column public.personal_context.function_id is
  'Stable AI surface/function identifier used to synthesize scoped user memory.';

drop index if exists personal_context_user_processed_created_idx;
drop index if exists personal_context_processed_created_idx;

create index if not exists personal_context_user_function_processed_created_idx
  on public.personal_context (user_id, function_id, processed, created_at desc);

create index if not exists personal_context_processed_function_created_idx
  on public.personal_context (processed, function_id, created_at desc);

alter table public.user_ai_profiles
  add column if not exists function_id text not null default 'global';

comment on column public.user_ai_profiles.function_id is
  'AI surface/function identifier for this synthesized prompt. Use global for cross-cutting preferences.';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_ai_profiles'::regclass
      and conname = 'user_ai_profiles_pkey'
  ) then
    alter table public.user_ai_profiles drop constraint user_ai_profiles_pkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_ai_profiles'::regclass
      and conname = 'user_ai_profiles_user_function_pkey'
  ) then
    alter table public.user_ai_profiles
      add constraint user_ai_profiles_user_function_pkey primary key (user_id, function_id);
  end if;
end;
$$;

create index if not exists user_ai_profiles_function_updated_idx
  on public.user_ai_profiles (function_id, updated_at desc);

comment on table public.user_ai_profiles is
  'Per-user, per-function synthesized AI system prompts generated from scoped Personal Context feedback.';
