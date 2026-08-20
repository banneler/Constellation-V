alter table public.contacts
  add column if not exists profile_url text;

comment on column public.contacts.profile_url is
  'HTTP(S) URL for a public company bio, leadership page, conference profile, or directory entry.';

-- Carry forward public profiles from previously approved Pathfinder candidates
-- without replacing anything a user has already saved on the contact.
update public.contacts as contact
set profile_url = nullif(trim(candidate.profile_url), '')
from public.pathfinder_candidates as candidate
where candidate.status = 'approved'
  and candidate.crm_contact_id = contact.id
  and nullif(trim(candidate.profile_url), '') is not null
  and nullif(trim(contact.profile_url), '') is null;

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
    select contact.id into existing_contact_id
    from public.contacts as contact
    where contact.account_id = candidate.account_id
      and lower(trim(coalesce(contact.email, ''))) = lower(trim(candidate.email_address))
    order by contact.id
    limit 1;
  end if;

  if existing_contact_id is null then
    select contact.id into existing_contact_id
    from public.contacts as contact
    where contact.account_id = candidate.account_id
      and lower(trim(coalesce(contact.first_name, ''))) = lower(trim(candidate.first_name))
      and lower(trim(coalesce(contact.last_name, ''))) = lower(trim(candidate.last_name))
    order by contact.id
    limit 1;
  end if;

  if existing_contact_id is not null then
    update public.contacts as contact
    set profile_url = nullif(trim(candidate.profile_url), '')
    where contact.id = existing_contact_id
      and nullif(trim(contact.profile_url), '') is null
      and nullif(trim(candidate.profile_url), '') is not null;

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
    profile_url,
    account_id,
    user_id,
    last_saved
  ) values (
    trim(candidate.first_name),
    trim(candidate.last_name),
    coalesce(candidate.email_address, ''),
    coalesce(candidate.phone, ''),
    trim(candidate.title),
    nullif(trim(candidate.profile_url), ''),
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

revoke all on function public.approve_pathfinder_candidate(uuid) from public;
grant execute on function public.approve_pathfinder_candidate(uuid) to authenticated;

comment on function public.approve_pathfinder_candidate(uuid) is
  'Approves a Pathfinder candidate, preserving owner/impersonation access and non-destructively mapping its public profile URL.';
