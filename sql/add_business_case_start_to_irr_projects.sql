-- Run once in Supabase SQL editor (or your migration runner) so saves include business case start.
-- Format stored: YYYY-MM (HTML month input), e.g. 2026-01

alter table public.irr_projects
  add column if not exists business_case_start text;

comment on column public.irr_projects.business_case_start is
  'First month of cash-flow model (Roger row 10 month 0). ISO month string YYYY-MM.';
