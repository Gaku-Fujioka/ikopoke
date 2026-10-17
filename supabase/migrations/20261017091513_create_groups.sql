-- Group persistence only. Invitations, editing and deletion are separate tasks.
-- Apply after inspecting the development project's existing schema.
begin;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80 and name ~ '[^[:space:]]'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members(user_id, group_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Explicit grants work with "automatically expose new tables" disabled.
revoke all on public.groups, public.group_members from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.groups, public.group_members to authenticated;

-- Membership is read only for the requesting user. This avoids recursive RLS
-- and prevents a client from adding itself to someone else's group.
create policy group_members_read_own on public.group_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy groups_read_member on public.groups
  for select to authenticated
  using (exists (
    select 1 from public.group_members as member
    where member.group_id = groups.id and member.user_id = (select auth.uid())
  ));

-- A single transaction creates BOTH the group and its first membership.
-- The identity always comes from the verified session, never a client user ID.
-- Reusing a request UUID with the same name is idempotent for its creator.
create function public.create_group(p_name text, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  -- Match JavaScript String.trim(), including Japanese and BOM whitespace.
  clean_name text := btrim(p_name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  inserted_id uuid;
  existing public.groups%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_request_id is null or clean_name is null or
     char_length(clean_name) not between 1 and 80 or clean_name !~ '[^[:space:]]' then
    raise exception 'invalid group input' using errcode = '22023';
  end if;

  insert into public.groups (id, name, created_by)
    values (p_request_id, clean_name, actor)
    on conflict (id) do nothing
    returning id into inserted_id;

  if inserted_id is null then
    select * into existing from public.groups where id = p_request_id;
    if existing.created_by is distinct from actor or existing.name is distinct from clean_name or
       not exists (select 1 from public.group_members where group_id = p_request_id and user_id = actor) then
      raise exception 'request conflict' using errcode = '23505';
    end if;
    return existing.id;
  end if;

  insert into public.group_members (group_id, user_id) values (inserted_id, actor);
  return inserted_id;
end;
$$;

-- Functions otherwise receive PUBLIC execute privileges by default.
revoke all on function public.create_group(text, uuid) from public, anon, authenticated;
grant execute on function public.create_group(text, uuid) to authenticated;

commit;
