-- Reusable invitations, valid for seven days. Store only token hashes.
begin;

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz
);
create index group_invites_group_id_idx on public.group_invites(group_id);
create index group_invites_created_by_idx on public.group_invites(created_by);
alter table public.group_invites enable row level security;
revoke all on public.group_invites from public, anon, authenticated;
-- The hash is not available through the Data API, even to members.
grant select (id, group_id, created_at, expires_at, revoked_at) on public.group_invites to authenticated;
create policy group_invites_read_member on public.group_invites
  for select to authenticated using (exists (
    select 1 from public.group_members as member
    where member.group_id = group_invites.group_id and member.user_id = (select auth.uid())
  ));

create function public.create_group_invite(p_group_id uuid, p_token_hash text)
returns table (id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid invite input' using errcode = '22023';
  end if;
  return query insert into public.group_invites as saved (group_id, token_hash, created_by)
    values (p_group_id, p_token_hash, auth.uid()) returning saved.id, saved.expires_at;
end;
$$;

-- Valid token holders may preview only the group they were invited to.
-- No group is disclosed to anonymous callers or invalid/expired tokens.
create function public.preview_group_invite(p_token text)
returns table (group_id uuid, group_name text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invite unavailable' using errcode = 'P0001';
  end if;
  return query select invitation.group_id, target.name, invitation.expires_at
    from public.group_invites as invitation join public.groups as target on target.id = invitation.group_id
    where invitation.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      and invitation.revoked_at is null and invitation.expires_at > clock_timestamp();
  if not found then
    raise exception 'invite unavailable' using errcode = 'P0001';
  end if;
end;
$$;

create function public.accept_group_invite(p_token text, p_group_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  invitation public.group_invites%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_group_id is null then
    raise exception 'invite unavailable' using errcode = 'P0001';
  end if;
  -- Revoke takes the same row lock. Check expiry after acquiring the lock.
  select * into invitation from public.group_invites
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
  if invitation.id is null or invitation.group_id <> p_group_id or
     invitation.revoked_at is not null or invitation.expires_at <= clock_timestamp() then
    raise exception 'invite unavailable' using errcode = 'P0001';
  end if;
  insert into public.group_members (group_id, user_id) values (invitation.group_id, actor)
    on conflict (group_id, user_id) do nothing;
  return invitation.group_id;
end;
$$;

create function public.revoke_group_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.group_invites as invitation set revoked_at = coalesce(invitation.revoked_at, now())
    where invitation.id = p_invite_id and auth.uid() is not null and exists (
      select 1 from public.group_members as member
      where member.group_id = invitation.group_id and member.user_id = auth.uid()
    );
  if not found then
    raise exception 'membership required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.create_group_invite(uuid, text), public.preview_group_invite(text),
  public.accept_group_invite(text, uuid), public.revoke_group_invite(uuid) from public, anon, authenticated;
grant execute on function public.create_group_invite(uuid, text), public.preview_group_invite(text),
  public.accept_group_invite(text, uuid), public.revoke_group_invite(uuid) to authenticated;
commit;
