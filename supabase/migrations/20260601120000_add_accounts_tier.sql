-- ABM Phase 1: accounts.tier as first-class strategic tier for filtering and list badges.

alter table public.accounts
  add column if not exists tier text not null default 'Unassigned';

alter table public.accounts
  drop constraint if exists accounts_tier_check;

alter table public.accounts
  add constraint accounts_tier_check
  check (tier in ('Tier 1', 'Tier 2', 'Tier 3', 'Unassigned'));

comment on column public.accounts.tier is
  'ABM strategic tier. Synced from SAOS account_snapshot.tier; Unassigned when unset.';

update public.accounts a
set tier = case
  when coalesce(ap.plan #>> '{current_draft,sections,account_snapshot,tier}', '') in ('Tier 1', 'Tier 2', 'Tier 3')
    then ap.plan #>> '{current_draft,sections,account_snapshot,tier}'
  else 'Unassigned'
end
from public.account_plans ap
where ap.account_id = a.id
  and (a.tier is null or a.tier = 'Unassigned');
