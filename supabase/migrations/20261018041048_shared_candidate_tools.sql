begin;
alter table public.items add column priority smallint not null default 0 check(priority between 0 and 3),
  add column archived_at timestamptz;
grant select(priority,archived_at) on public.items to authenticated;
alter table public.item_comments add column revision integer not null default 1 check(revision>0);
create index items_active_group_idx on public.items(group_id,created_at desc,id desc) where archived_at is null;

create function public.browse_items(
  p_group_id uuid default null, p_query text default '', p_kind text default null,
  p_reaction text default null, p_list_id uuid default null, p_unclassified boolean default false,
  p_archived boolean default false, p_visited text default null, p_priority integer default null,
  p_sort text default 'newest', p_page integer default 1
) returns table(items jsonb,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_group_id is not null and not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then raise exception 'membership required' using errcode='42501'; end if;
  if p_query is null or char_length(p_query)>100 or p_page is null or p_page not between 1 and 999999 or
    p_archived is null or p_unclassified is null or p_sort is null or p_sort not in ('newest','recommended') or
    (p_kind is not null and p_kind not in ('spot','activity')) or
    (p_reaction is not null and p_reaction not in ('want_to_go','not_now','unreacted')) or
    (p_visited is not null and p_visited not in ('visited','unvisited')) or
    (p_priority is not null and p_priority not between 0 and 3)
  then raise exception 'invalid search' using errcode='22023'; end if;
  return query with matching as materialized (
    select i.id,i.group_id,i.title,i.kind,i.memo,i.created_at,i.priority,i.archived_at,
      (select count(*) from public.item_reactions r where r.item_id=i.id and r.value='want_to_go') want_count,
      exists(select 1 from public.visits v where v.item_id=i.id and v.group_id=i.group_id) visited,
      (select r.value from public.item_reactions r where r.item_id=i.id and r.user_id=actor) my_reaction
    from public.items i join public.group_members member on member.group_id=i.group_id and member.user_id=actor
    where (p_group_id is null or i.group_id=p_group_id) and (i.archived_at is not null)=p_archived
      and strpos(lower(i.title),lower(p_query))>0 and (p_kind is null or i.kind=p_kind)
      and (p_priority is null or i.priority=p_priority)
      and (p_list_id is null or exists(select 1 from public.item_list_memberships m where m.item_id=i.id and m.group_id=i.group_id and m.list_id=p_list_id))
      and (not p_unclassified or not exists(select 1 from public.item_list_memberships m where m.item_id=i.id))
  ), filtered as materialized (
    select m.*,m.want_count+m.priority as score from matching m where
      (p_reaction is null or (p_reaction='unreacted' and m.my_reaction is null) or m.my_reaction=p_reaction)
      and (p_visited is null or m.visited=(p_visited='visited'))
  ), page as (
    select f.* from filtered f order by
      case when p_sort='recommended' then f.score end desc,
      case when p_sort='recommended' then f.want_count end desc,f.created_at desc,f.id desc
      limit 20 offset (p_page-1)*20
  ) select coalesce((select jsonb_agg(to_jsonb(r) order by
      case when p_sort='recommended' then r.score end desc,
      case when p_sort='recommended' then r.want_count end desc,r.created_at desc,r.id desc) from page r),'[]'::jsonb),
      (select count(*) from filtered);
end; $$;

create function public.set_item_attributes(p_group_id uuid,p_item_id uuid,p_priority integer,p_expected_priority integer,p_archived boolean,p_expected_archived boolean)
returns void language plpgsql security definer set search_path='' as $$
declare current_item public.items%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  if p_priority is null or p_priority not between 0 and 3 or p_expected_priority is null or p_archived is null or p_expected_archived is null then raise exception 'invalid attributes' using errcode='22023'; end if;
  select * into current_item from public.items where id=p_item_id and group_id=p_group_id for update;
  if not found then raise exception 'candidate unavailable' using errcode='42501'; end if;
  if current_item.priority=p_priority and (current_item.archived_at is not null)=p_archived then return; end if;
  if current_item.priority<>p_expected_priority or (current_item.archived_at is not null)<>p_expected_archived then raise exception 'candidate changed' using errcode='40001'; end if;
  update public.items set priority=p_priority,archived_at=case when p_archived then coalesce(archived_at,now()) else null end where id=p_item_id;
end; $$;

create function public.get_named_item_reactions(p_group_id uuid,p_item_id uuid)
returns table(value text,display_name text,is_mine boolean,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) or
    not exists(select 1 from public.items where id=p_item_id and group_id=p_group_id) then raise exception 'candidate unavailable' using errcode='42501'; end if;
  return query select r.value,case when m.user_id is null then '退出したメンバー' else coalesce(p.display_name,'表示名未設定') end,r.user_id=auth.uid(),count(*) over()
    from public.item_reactions r left join public.group_members m on m.group_id=p_group_id and m.user_id=r.user_id
    left join public.profiles p on p.user_id=m.user_id
    where r.item_id=p_item_id order by r.updated_at desc,r.user_id limit 100;
end; $$;

create function public.get_named_item_comments(p_group_id uuid,p_item_id uuid,p_page integer)
returns table(comments jsonb,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) or
    not exists(select 1 from public.items where id=p_item_id and group_id=p_group_id) then raise exception 'candidate unavailable' using errcode='42501'; end if;
  if p_page is null or p_page not between 1 and 999999 then raise exception 'invalid page' using errcode='22023'; end if;
  return query with rows as (
    select c.id,c.body,c.created_at,c.revision,c.created_by=auth.uid() is true as is_mine,
      case when m.user_id is null then '退出したメンバー' else coalesce(p.display_name,'表示名未設定') end as display_name,
      (c.created_by=auth.uid() or m.user_id is null) is true as can_delete
    from public.item_comments c left join public.group_members m on m.group_id=p_group_id and m.user_id=c.created_by
    left join public.profiles p on p.user_id=m.user_id where c.item_id=p_item_id
    order by c.created_at desc,c.id desc limit 20 offset (p_page-1)*20
  ) select coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from rows r),'[]'::jsonb),
    (select count(*) from public.item_comments c where c.item_id=p_item_id);
end; $$;

create function public.edit_item_comment(p_group_id uuid,p_item_id uuid,p_comment_id uuid,p_body text,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare result integer; clean_body text:=btrim(p_body,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) or
    not exists(select 1 from public.items where id=p_item_id and group_id=p_group_id) then raise exception 'candidate unavailable' using errcode='42501'; end if;
  if clean_body is null or char_length(clean_body) not between 1 and 2000 or clean_body !~ '[^[:space:]]' then raise exception 'invalid comment' using errcode='22023'; end if;
  perform 1 from public.item_comments where id=p_comment_id and item_id=p_item_id and created_by=auth.uid() for update;
  if not found then raise exception 'comment unavailable' using errcode='42501'; end if;
  update public.item_comments set body=clean_body,revision=revision+1 where id=p_comment_id and revision=p_expected_revision returning revision into result;
  if result is null then raise exception 'comment changed' using errcode='40001'; end if;
  return result;
end; $$;
create function public.delete_item_comment(p_group_id uuid,p_item_id uuid,p_comment_id uuid,p_expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare row public.item_comments%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) or
    not exists(select 1 from public.items where id=p_item_id and group_id=p_group_id) then raise exception 'candidate unavailable' using errcode='42501'; end if;
  select * into row from public.item_comments where id=p_comment_id and item_id=p_item_id for update;
  if not found then return; end if;
  if row.created_by is distinct from auth.uid() and exists(select 1 from public.group_members where group_id=p_group_id and user_id=row.created_by) then raise exception 'comment unavailable' using errcode='42501'; end if;
  if row.revision is distinct from p_expected_revision then raise exception 'comment changed' using errcode='40001'; end if;
  delete from public.item_comments where id=row.id;
end; $$;

revoke all on function public.browse_items(uuid,text,text,text,uuid,boolean,boolean,text,integer,text,integer),
 public.set_item_attributes(uuid,uuid,integer,integer,boolean,boolean),public.get_named_item_reactions(uuid,uuid),
 public.get_named_item_comments(uuid,uuid,integer),public.edit_item_comment(uuid,uuid,uuid,text,integer),public.delete_item_comment(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.browse_items(uuid,text,text,text,uuid,boolean,boolean,text,integer,text,integer),
 public.set_item_attributes(uuid,uuid,integer,integer,boolean,boolean),public.get_named_item_reactions(uuid,uuid),
 public.get_named_item_comments(uuid,uuid,integer),public.edit_item_comment(uuid,uuid,uuid,text,integer),public.delete_item_comment(uuid,uuid,uuid,integer) to authenticated;
commit;
