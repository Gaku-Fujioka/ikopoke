-- Shared candidates: creation and member-only reading. No editing or deletion.
-- Inspect the target project's schema before applying this migration.
begin;

create table public.items (
  id uuid primary key,
  group_id uuid not null references public.groups(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 100 and title ~ '[^[:space:]]'),
  kind text not null check (kind in ('spot', 'activity')),
  memo text not null default '' check (char_length(memo) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index items_group_created_idx on public.items(group_id, created_at desc, id desc);
create index items_created_by_idx on public.items(created_by);

alter table public.items enable row level security;
revoke all on public.items from public, anon, authenticated;
grant select on public.items to authenticated;
create policy items_read_member on public.items
  for select to authenticated
  using (exists (
    select 1 from public.group_members as member
    where member.group_id = items.group_id and member.user_id = (select auth.uid())
  ));

create function public.create_item(p_group_id uuid, p_title text, p_kind text, p_memo text, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  trim_chars text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  clean_title text := btrim(p_title, trim_chars);
  clean_memo text := btrim(coalesce(p_memo, ''), trim_chars);
  inserted_id uuid;
  existing public.items%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_group_id is null or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = actor
  ) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  if p_request_id is null or clean_title is null or
     char_length(clean_title) not between 1 and 100 or clean_title !~ '[^[:space:]]' or
     p_kind is null or p_kind not in ('spot', 'activity') or char_length(clean_memo) > 2000 then
    raise exception 'invalid item input' using errcode = '22023';
  end if;

  insert into public.items(id, group_id, title, kind, memo, created_by)
    values (p_request_id, p_group_id, clean_title, p_kind, clean_memo, actor)
    on conflict (id) do nothing returning id into inserted_id;
  if inserted_id is null then
    select * into existing from public.items where id = p_request_id;
    if existing.created_by is distinct from actor or existing.group_id is distinct from p_group_id or
       existing.title is distinct from clean_title or existing.kind is distinct from p_kind or
       existing.memo is distinct from clean_memo then
      raise exception 'request conflict' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  return inserted_id;
end;
$$;
revoke all on function public.create_item(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_item(uuid, text, text, text, uuid) to authenticated;

commit;
