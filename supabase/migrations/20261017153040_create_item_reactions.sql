-- One current reaction per user and candidate. Inspect target before applying.
begin;

create table public.item_reactions (
  item_id uuid not null references public.items(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  value text not null check (value in ('want_to_go', 'not_now')),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index item_reactions_user_id_idx on public.item_reactions(user_id);
alter table public.item_reactions enable row level security;
revoke all on public.item_reactions from public, anon, authenticated;
grant select on public.item_reactions to authenticated;

-- Raw rows expose only the requesting member's own reaction. Totals are
-- returned by an authorized RPC, without exposing other members' identifiers.
create policy item_reactions_read_own on public.item_reactions
  for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.items as item
    join public.group_members as member on member.group_id = item.group_id
    where item.id = item_reactions.item_id and member.user_id = (select auth.uid())
  ));

create function public.get_item_reactions(p_group_id uuid, p_item_id uuid)
returns table (want_count bigint, not_now_count bigint, my_reaction text)
language plpgsql stable security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.items as item
    join public.group_members as member on member.group_id = item.group_id
    where item.id = p_item_id and item.group_id = p_group_id and member.user_id = actor
  ) then
    raise exception 'candidate unavailable' using errcode = '42501';
  end if;
  return query select
    count(*) filter (where reaction.value = 'want_to_go'),
    count(*) filter (where reaction.value = 'not_now'),
    max(reaction.value) filter (where reaction.user_id = actor)
  from public.item_reactions as reaction where reaction.item_id = p_item_id;
end;
$$;

create function public.set_item_reaction(p_group_id uuid, p_item_id uuid, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.items as item
    join public.group_members as member on member.group_id = item.group_id
    where item.id = p_item_id and item.group_id = p_group_id and member.user_id = actor
  ) then
    raise exception 'candidate unavailable' using errcode = '42501';
  end if;
  if p_value is not null and p_value not in ('want_to_go', 'not_now') then
    raise exception 'invalid reaction' using errcode = '22023';
  end if;

  -- Serialize this user's saves and cancellations even when no reaction row
  -- exists yet. Different users can react independently. This does not define
  -- future candidate editing or membership-removal behavior.
  perform 1 from public.group_members
    where group_id = p_group_id and user_id = actor for update;
  if not found then
    raise exception 'membership required' using errcode = '42501';
  end if;

  if p_value is null then
    delete from public.item_reactions where item_id = p_item_id and user_id = actor;
  else
    insert into public.item_reactions(item_id, user_id, value)
      values(p_item_id, actor, p_value)
      on conflict (item_id, user_id) do update set value = excluded.value, updated_at = now();
  end if;
end;
$$;

revoke all on function public.get_item_reactions(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_item_reaction(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.get_item_reactions(uuid, uuid) to authenticated;
grant execute on function public.set_item_reaction(uuid, uuid, text) to authenticated;
commit;
