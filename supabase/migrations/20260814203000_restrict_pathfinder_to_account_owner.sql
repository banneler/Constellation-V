-- Pathfinder candidates, evidence, jobs, and review actions are private to the
-- user who owns the associated account. Service-role workers continue to
-- bypass RLS.

create or replace function public.pathfinder_can_access_owner(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and auth.uid() = target_user_id;
$$;

revoke all on function public.pathfinder_can_access_owner(uuid) from public;
grant execute on function public.pathfinder_can_access_owner(uuid) to authenticated;

comment on function public.pathfinder_can_access_owner(uuid) is
  'Returns true only when the authenticated user owns the Pathfinder account data.';
