-- Shared single-day plans. Time and period remain stored when the display mode changes.
begin;

create table public.outings (
  id uuid primary key,
  group_id uuid not null references public.groups(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120 and title ~ '[^[:space:]]'),
  outing_date date not null,
  mode text not null check (mode in ('exact', 'period', 'order')),
  memo text not null default '' check (char_length(memo) <= 2000),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id)
);
create index outings_group_date_idx on public.outings(group_id, outing_date, id);
create index outings_created_by_idx on public.outings(created_by);

create table public.outing_items (
  outing_id uuid not null,
  group_id uuid not null,
  item_id uuid not null,
  position integer not null check (position >= 0),
  planned_time time without time zone,
  period text check (period in ('morning', 'noon', 'afternoon', 'night')),
  primary key (outing_id, item_id),
  unique (outing_id, position),
  foreign key (outing_id, group_id) references public.outings(id, group_id) on delete restrict,
  foreign key (item_id, group_id) references public.items(id, group_id) on delete restrict
);
create index outing_items_item_idx on public.outing_items(item_id, group_id);

create table public.outing_participants (
  outing_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  primary key (outing_id, user_id),
  foreign key (outing_id, group_id) references public.outings(id, group_id) on delete restrict,
  foreign key (group_id, user_id) references public.group_members(group_id, user_id) on delete restrict,
  foreign key (user_id) references public.profiles(user_id) on delete restrict
);
create index outing_participants_user_idx on public.outing_participants(user_id, group_id);

alter table public.outings enable row level security;
alter table public.outing_items enable row level security;
alter table public.outing_participants enable row level security;
revoke all on public.outings, public.outing_items, public.outing_participants from public, anon, authenticated;
grant select(id, group_id, title, outing_date, mode, memo, revision, created_at, updated_at) on public.outings to authenticated;
grant select(outing_id, group_id, item_id, position, planned_time, period) on public.outing_items to authenticated;
grant select(outing_id, group_id, user_id) on public.outing_participants to authenticated;

create policy outings_read_member on public.outings for select to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = outings.group_id and m.user_id = (select auth.uid())
));
create policy outing_items_read_member on public.outing_items for select to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = outing_items.group_id and m.user_id = (select auth.uid())
));
create policy outing_participants_read_member on public.outing_participants for select to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = outing_participants.group_id and m.user_id = (select auth.uid())
));

-- A single RPC validates membership, same-group references and optimistic revision.
-- Every edit replaces only the plan's links; source items and profiles are retained.
create function public.save_outing(
  p_group_id uuid, p_outing_id uuid, p_expected_revision integer,
  p_title text, p_date date, p_mode text, p_memo text,
  p_items jsonb, p_participants uuid[]
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  trim_chars text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  clean_title text := btrim(p_title, trim_chars);
  existing public.outings%rowtype;
  entry jsonb;
  entry_id uuid;
  entry_time time;
  entry_period text;
  position_number integer := 0;
  participant_id uuid;
  next_revision integer;
begin
  if actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_group_id is null or not exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = actor
  ) then raise exception 'group unavailable' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.user_id = actor) then
    raise exception 'display name required' using errcode = '22023';
  end if;
  if p_outing_id is null or p_expected_revision is null or p_expected_revision < 0 or
     clean_title is null or char_length(clean_title) not between 1 and 120 or
     clean_title !~ '[^[:space:]]' or p_date is null or
     p_mode is null or p_mode not in ('exact', 'period', 'order') or
     p_memo is null or char_length(p_memo) > 2000 or
     p_items is null or jsonb_typeof(p_items) is distinct from 'array' or
     jsonb_array_length(p_items) not between 1 and 50 or
     p_participants is null or cardinality(p_participants) not between 1 and 50 then
    raise exception 'invalid outing input' using errcode = '22023';
  end if;
  if (select count(*) from unnest(p_participants) u) is distinct from
     (select count(distinct u) from unnest(p_participants) u) or
     exists (select 1 from unnest(p_participants) u where u is null) then
    raise exception 'duplicate or missing participant' using errcode = '22023';
  end if;
  if (select count(*) from unnest(p_participants) u
      join public.group_members m on m.group_id = p_group_id and m.user_id = u
      join public.profiles p on p.user_id = u) <> cardinality(p_participants) then
    raise exception 'participant unavailable' using errcode = '42501';
  end if;

  select * into existing from public.outings where id = p_outing_id for update;
  if found then
    if existing.group_id is distinct from p_group_id then
      raise exception 'outing unavailable' using errcode = '42501';
    end if;
    if p_expected_revision = 0 and existing.revision = 1 and existing.created_by = actor then
      return existing.revision; -- retry of a completed create request
    end if;
    if p_expected_revision is distinct from existing.revision then
      raise exception 'outing changed' using errcode = '40001';
    end if;
    update public.outings set title = clean_title, outing_date = p_date,
      mode = p_mode, memo = p_memo, revision = revision + 1, updated_at = now()
      where id = p_outing_id returning revision into next_revision;
    delete from public.outing_items where outing_id = p_outing_id;
    delete from public.outing_participants where outing_id = p_outing_id;
  else
    if p_expected_revision <> 0 then raise exception 'outing unavailable' using errcode = '42501'; end if;
    insert into public.outings (id, group_id, title, outing_date, mode, memo, created_by)
      values (p_outing_id, p_group_id, clean_title, p_date, p_mode, p_memo, actor)
      on conflict (id) do nothing returning revision into next_revision;
    if next_revision is null then
      select * into existing from public.outings where id = p_outing_id for update;
      if existing.group_id = p_group_id and existing.created_by = actor and existing.revision = 1 then
        return existing.revision;
      end if;
      raise exception 'request conflict' using errcode = '23505';
    end if;
    next_revision := 1;
  end if;

  for entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry) is distinct from 'object' then
      raise exception 'invalid outing item' using errcode = '22023';
    end if;
    entry_id := (entry->>'item_id')::uuid;
    entry_time := nullif(entry->>'planned_time', '')::time;
    entry_period := nullif(entry->>'period', '');
    if entry_id is null or
       (entry_period is not null and entry_period not in ('morning','noon','afternoon','night')) or
       (p_mode = 'exact' and entry_time is null) or
       (p_mode = 'period' and entry_period is null) then
      raise exception 'invalid outing item' using errcode = '22023';
    end if;
    if not exists (select 1 from public.items i where i.id = entry_id and i.group_id = p_group_id) then
      raise exception 'item unavailable' using errcode = '42501';
    end if;
    insert into public.outing_items (outing_id, group_id, item_id, position, planned_time, period)
      values (p_outing_id, p_group_id, entry_id, position_number, entry_time, entry_period);
    position_number := position_number + 1;
  end loop;
  foreach participant_id in array p_participants loop
    insert into public.outing_participants (outing_id, group_id, user_id)
      values (p_outing_id, p_group_id, participant_id);
  end loop;
  return next_revision;
end;
$$;
revoke all on function public.save_outing(uuid, uuid, integer, text, date, text, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.save_outing(uuid, uuid, integer, text, date, text, text, jsonb, uuid[]) to authenticated;

commit;
