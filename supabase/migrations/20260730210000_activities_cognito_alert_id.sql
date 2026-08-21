-- Link CRM activities to the specific Cognito alert that prompted them.
-- Insights conversion prefers this FK (1 activity → 1 alert); unlinked
-- historical rows fall back to a greedy 1:1 assignment in the app.

alter table public.activities
  add column if not exists cognito_alert_id bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_cognito_alert_id_fkey'
  ) then
    alter table public.activities
      add constraint activities_cognito_alert_id_fkey
      foreign key (cognito_alert_id)
      references public.cognito_alerts (id)
      on delete set null;
  end if;
end $$;

create index if not exists activities_cognito_alert_id_idx
  on public.activities (cognito_alert_id)
  where cognito_alert_id is not null;
