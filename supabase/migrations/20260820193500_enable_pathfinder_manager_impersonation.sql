-- Account owners retain private access. Active managers and administrators may
-- access a selected owner's Pathfinder data through the CRM impersonation UI.

create or replace function public.pathfinder_can_access_owner(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and (
      auth.uid() = target_user_id
      or exists (
        select 1
        from public.user_quotas uq
        where uq.user_id = auth.uid()
          and coalesce(uq.is_manager, false) = true
          and uq.deactivated_at is null
      )
      or coalesce(
        (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean,
        false
      ) = true
    );
$$;

revoke all on function public.pathfinder_can_access_owner(uuid) from public;
grant execute on function public.pathfinder_can_access_owner(uuid) to authenticated;

comment on function public.pathfinder_can_access_owner(uuid) is
  'Allows owners plus active managers/admins using CRM impersonation to access Pathfinder data.';
