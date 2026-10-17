-- Account-wide display names. Email addresses are never exposed to group members.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 80 and display_name ~ '[^[:space:]]'),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select (user_id, display_name), insert (user_id, display_name), update (display_name, updated_at)
  on public.profiles to authenticated;

create policy profiles_read_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The signup metadata is only an initial name, never an authorization source.
-- Invalid or absent metadata leaves the profile unset instead of blocking signup.
create schema if not exists kokoiko_private;
revoke all on schema kokoiko_private from public, anon, authenticated;
create function kokoiko_private.create_profile_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  raw_name text := to_jsonb(new)->'raw_user_meta_data'->>'display_name';
  clean_name text := btrim(raw_name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
begin
  if clean_name is not null and char_length(clean_name) between 1 and 80 and clean_name ~ '[^[:space:]]' then
    insert into public.profiles (user_id, display_name) values (new.id, clean_name);
  end if;
  return new;
end;
$$;
revoke all on function kokoiko_private.create_profile_on_signup() from public, anon, authenticated;
create trigger create_profile_on_signup after insert on auth.users
  for each row execute function kokoiko_private.create_profile_on_signup();

-- Existing accounts can set or change their own name. RLS is still enforced.
create function public.set_my_display_name(p_name text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  clean_name text := btrim(p_name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if clean_name is null or char_length(clean_name) not between 1 and 80 or clean_name !~ '[^[:space:]]' then
    raise exception 'invalid display name' using errcode = '22023';
  end if;
  insert into public.profiles (user_id, display_name) values (actor, clean_name)
    on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now();
  return clean_name;
end;
$$;
revoke all on function public.set_my_display_name(text) from public, anon, authenticated;
grant execute on function public.set_my_display_name(text) to authenticated;

-- Only a member may see this group's participant names; no emails or other metadata.
create function public.get_group_members(p_group_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or p_group_id is null or not exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = actor
  ) then
    raise exception 'group unavailable' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.display_name
    from public.group_members m
    left join public.profiles p on p.user_id = m.user_id
    where m.group_id = p_group_id
    order by m.joined_at, m.user_id;
end;
$$;
revoke all on function public.get_group_members(uuid) from public, anon, authenticated;
grant execute on function public.get_group_members(uuid) to authenticated;

commit;
