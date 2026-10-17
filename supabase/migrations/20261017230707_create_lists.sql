-- Multiple classifications per candidate. Delete only classification links.
begin;

alter table public.items add constraint items_id_group_key unique (id, group_id);
create table public.lists (
  id uuid primary key,
  group_id uuid not null references public.groups(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, group_id)
);
create index lists_group_created_idx on public.lists(group_id, created_at desc, id desc);
create index lists_created_by_idx on public.lists(created_by);
create table public.item_list_memberships (
  item_id uuid not null,
  list_id uuid not null,
  group_id uuid not null,
  primary key (item_id, list_id),
  foreign key (item_id, group_id) references public.items(id, group_id) on delete restrict,
  foreign key (list_id, group_id) references public.lists(id, group_id) on delete cascade
);
create index item_list_memberships_list_idx on public.item_list_memberships(list_id, group_id, item_id);
create index item_list_memberships_group_idx on public.item_list_memberships(group_id, item_id);

alter table public.lists enable row level security;
alter table public.item_list_memberships enable row level security;
revoke all on public.lists, public.item_list_memberships from public, anon, authenticated;
grant select(id, group_id, name, created_at), insert(id, group_id, name), update(name) on public.lists to authenticated;
grant delete on public.lists to authenticated;
grant select, insert, delete on public.item_list_memberships to authenticated;

create policy lists_read_member on public.lists for select to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = lists.group_id and m.user_id = (select auth.uid())
));
create policy lists_create_member on public.lists for insert to authenticated with check (
  created_by = (select auth.uid()) and exists (
    select 1 from public.group_members m where m.group_id = lists.group_id and m.user_id = (select auth.uid())
  )
);
create policy lists_update_member on public.lists for update to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = lists.group_id and m.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.group_members m where m.group_id = lists.group_id and m.user_id = (select auth.uid())
));
create policy lists_delete_member on public.lists for delete to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = lists.group_id and m.user_id = (select auth.uid())
));
create policy item_lists_read_member on public.item_list_memberships for select to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = item_list_memberships.group_id and m.user_id = (select auth.uid())
));
create policy item_lists_create_member on public.item_list_memberships for insert to authenticated with check (exists (
  select 1 from public.group_members m where m.group_id = item_list_memberships.group_id and m.user_id = (select auth.uid())
));
create policy item_lists_delete_member on public.item_list_memberships for delete to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = item_list_memberships.group_id and m.user_id = (select auth.uid())
));

create function public.create_list(p_group_id uuid, p_name text, p_request_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  trim_chars text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  clean_name text := btrim(p_name, trim_chars);
  inserted_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = (select auth.uid())) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  if p_request_id is null or clean_name is null or char_length(clean_name) not between 1 and 80 then
    raise exception 'invalid list input' using errcode = '22023';
  end if;
  insert into public.lists(id, group_id, name) values(p_request_id, p_group_id, clean_name)
    on conflict (id) do nothing returning id into inserted_id;
  if inserted_id is null then
    if not exists (select 1 from public.lists where id = p_request_id and group_id = p_group_id and name = clean_name) then
      raise exception 'request conflict' using errcode = '23505';
    end if;
    return p_request_id;
  end if;
  return inserted_id;
end;
$$;

create function public.rename_list(p_group_id uuid, p_list_id uuid, p_name text, p_expected_name text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  trim_chars text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  clean_name text := btrim(p_name, trim_chars);
  current_name text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select name into current_name from public.lists where id = p_list_id and group_id = p_group_id for update;
  if not found then raise exception 'list unavailable' using errcode = '42501'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 80 or p_expected_name is null then
    raise exception 'invalid list input' using errcode = '22023';
  end if;
  if current_name = clean_name then return; end if;
  if current_name is distinct from p_expected_name then raise exception 'list changed' using errcode = '40001'; end if;
  update public.lists set name = clean_name where id = p_list_id and group_id = p_group_id;
end;
$$;

create function public.delete_list(p_group_id uuid, p_list_id uuid, p_expected_name text)
returns void language plpgsql security invoker set search_path = '' as $$
declare current_name text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = (select auth.uid())) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  select name into current_name from public.lists where id = p_list_id and group_id = p_group_id for update;
  if not found then return; end if;
  if p_expected_name is null then raise exception 'invalid list input' using errcode = '22023'; end if;
  if current_name is distinct from p_expected_name then raise exception 'list changed' using errcode = '40001'; end if;
  delete from public.lists where id = p_list_id and group_id = p_group_id;
end;
$$;

create function public.set_item_list(p_group_id uuid, p_item_id uuid, p_list_id uuid, p_selected boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  perform 1 from public.lists where id = p_list_id and group_id = p_group_id for update;
  if not found or not exists (select 1 from public.items where id = p_item_id and group_id = p_group_id) then
    raise exception 'classification unavailable' using errcode = '42501';
  end if;
  if p_selected is null then raise exception 'invalid selection' using errcode = '22023'; end if;
  if p_selected then
    insert into public.item_list_memberships(item_id, list_id, group_id) values(p_item_id, p_list_id, p_group_id)
      on conflict (item_id, list_id) do nothing;
  else
    delete from public.item_list_memberships where item_id = p_item_id and list_id = p_list_id and group_id = p_group_id;
  end if;
end;
$$;

create function public.get_item_lists(p_group_id uuid, p_item_id uuid, p_query text, p_page integer)
returns table(lists jsonb, total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.items where id = p_item_id and group_id = p_group_id) then
    raise exception 'candidate unavailable' using errcode = '42501';
  end if;
  if p_query is null or char_length(p_query) > 100 or p_page is null or p_page not between 1 and 999999 then
    raise exception 'invalid query' using errcode = '22023';
  end if;
  return query with matching as (
    select l.id, l.name, l.created_at from public.lists l where l.group_id = p_group_id and strpos(lower(l.name), lower(p_query)) > 0
  ), page_rows as (
    select l.id, l.name, l.created_at, exists (select 1 from public.item_list_memberships m where m.item_id = p_item_id and m.list_id = l.id and m.group_id = p_group_id) as is_selected
    from matching l order by l.created_at desc, l.id desc limit 20 offset (p_page - 1) * 20
  ) select
    (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'is_selected', r.is_selected) order by r.created_at desc, r.id desc), '[]'::jsonb) from page_rows r),
    (select count(*) from matching);
end;
$$;

create function public.get_group_items(p_group_id uuid, p_query text, p_kind text, p_reaction text, p_list_id uuid, p_unclassified boolean, p_page integer)
returns table(items jsonb, total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = (select auth.uid())) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  if p_list_id is not null and not exists (select 1 from public.lists where id = p_list_id and group_id = p_group_id) then
    raise exception 'list unavailable' using errcode = '42501';
  end if;
  if p_query is null or char_length(p_query) > 100 or p_unclassified is null or
     (p_list_id is not null and p_unclassified) or p_page is null or p_page not between 1 and 999999 or
     (p_kind is not null and p_kind not in ('spot','activity')) or
     (p_reaction is not null and p_reaction not in ('want_to_go','not_now','unreacted')) then
    raise exception 'invalid query' using errcode = '22023';
  end if;
  return query with matching as (
    select i.id, i.created_at from public.items i
    left join public.item_reactions reaction on reaction.item_id = i.id and reaction.user_id = (select auth.uid())
    where i.group_id = p_group_id and strpos(lower(i.title), lower(p_query)) > 0
      and (p_kind is null or i.kind = p_kind)
      and (p_reaction is null or (p_reaction = 'unreacted' and reaction.value is null) or reaction.value = p_reaction)
      and (p_list_id is null or exists (select 1 from public.item_list_memberships m where m.item_id = i.id and m.group_id = p_group_id and m.list_id = p_list_id))
      and (not p_unclassified or not exists (select 1 from public.item_list_memberships m where m.item_id = i.id and m.group_id = p_group_id))
  ), page_rows as (
    select i.id, i.group_id, i.title, i.kind, i.memo, i.created_at from matching m
    join public.items i on i.id = m.id and i.group_id = p_group_id
    order by m.created_at desc, m.id desc limit 20 offset (p_page - 1) * 20
  ) select
    (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'group_id', r.group_id, 'title', r.title, 'kind', r.kind, 'memo', r.memo, 'created_at', r.created_at) order by r.created_at desc, r.id desc), '[]'::jsonb) from page_rows r),
    (select count(*) from matching);
end;
$$;

revoke all on function public.create_list(uuid,text,uuid), public.rename_list(uuid,uuid,text,text), public.delete_list(uuid,uuid,text), public.set_item_list(uuid,uuid,uuid,boolean), public.get_item_lists(uuid,uuid,text,integer), public.get_group_items(uuid,text,text,text,uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.create_list(uuid,text,uuid), public.rename_list(uuid,uuid,text,text), public.delete_list(uuid,uuid,text), public.set_item_list(uuid,uuid,uuid,boolean), public.get_item_lists(uuid,uuid,text,integer), public.get_group_items(uuid,text,text,text,uuid,boolean,integer) to authenticated;
commit;
