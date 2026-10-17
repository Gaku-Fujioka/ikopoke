-- Member-only comments, with no edit/delete API or exposed author identifiers.
begin;
create table public.item_comments (
  id uuid primary key,
  item_id uuid not null references public.items(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000 and body ~ '[^[:space:]]'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index item_comments_item_created_idx on public.item_comments(item_id, created_at desc, id desc);
create index item_comments_created_by_idx on public.item_comments(created_by);
alter table public.item_comments enable row level security;
revoke all on public.item_comments from public, anon, authenticated;
grant select (id, item_id, body, created_at) on public.item_comments to authenticated;
create policy item_comments_read_member on public.item_comments
  for select to authenticated using (exists (
    select 1 from public.items as item
    join public.group_members as member on member.group_id = item.group_id
    where item.id = item_comments.item_id and member.user_id = (select auth.uid())
  ));

create function public.create_item_comment(p_group_id uuid, p_item_id uuid, p_body text, p_request_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  trim_chars text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  clean_body text := btrim(p_body, trim_chars);
  inserted_id uuid;
  existing public.item_comments%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  perform 1 from public.group_members
    where group_id = p_group_id and user_id = actor for share;
  if not found or not exists (select 1 from public.items where id = p_item_id and group_id = p_group_id) then
    raise exception 'candidate unavailable' using errcode = '42501';
  end if;
  if p_request_id is null or clean_body is null or char_length(clean_body) not between 1 and 2000 or clean_body !~ '[^[:space:]]' then
    raise exception 'invalid comment input' using errcode = '22023';
  end if;
  insert into public.item_comments(id, item_id, body, created_by)
    values(p_request_id, p_item_id, clean_body, actor)
    on conflict (id) do nothing returning id into inserted_id;
  if inserted_id is null then
    select * into existing from public.item_comments where id = p_request_id;
    if existing.item_id is distinct from p_item_id or existing.created_by is distinct from actor or existing.body is distinct from clean_body then
      raise exception 'request conflict' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  return inserted_id;
end;
$$;

create function public.get_item_comments(p_group_id uuid, p_item_id uuid, p_page integer)
returns table(comments jsonb, total_count bigint)
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
  if p_page is null or p_page not between 1 and 999999 then
    raise exception 'invalid page' using errcode = '22023';
  end if;
  return query select
    (select coalesce(jsonb_agg(jsonb_build_object(
      'id', entry.id, 'body', entry.body, 'created_at', entry.created_at, 'is_mine', entry.created_by = actor
    ) order by entry.created_at desc, entry.id desc), '[]'::jsonb)
      from (select comment.id, comment.body, comment.created_at, comment.created_by
        from public.item_comments as comment where comment.item_id = p_item_id
        order by comment.created_at desc, comment.id desc limit 20 offset (p_page - 1) * 20) as entry),
    (select count(*) from public.item_comments as comment where comment.item_id = p_item_id);
end;
$$;

revoke all on function public.create_item_comment(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.get_item_comments(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.create_item_comment(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.get_item_comments(uuid, uuid, integer) to authenticated;
commit;
