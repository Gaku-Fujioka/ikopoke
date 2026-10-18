begin;
create table public.visits (
  id uuid primary key,
  group_id uuid not null references public.groups(id) on delete restrict,
  item_id uuid not null,
  outing_id uuid,
  item_title text not null check (char_length(item_title) between 1 and 100),
  visited_on date not null,
  note text not null default '' check (char_length(note) <= 2000),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, group_id),
  foreign key (item_id, group_id) references public.items(id, group_id) on delete restrict,
  foreign key (outing_id, group_id) references public.outings(id, group_id) on delete restrict
);
create index visits_group_date_idx on public.visits(group_id, visited_on desc, id);
create index visits_item_group_idx on public.visits(item_id, group_id);
create index visits_outing_group_idx on public.visits(outing_id, group_id);
create index visits_created_by_idx on public.visits(created_by);
create table public.visit_ratings (
  visit_id uuid not null references public.visits(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  value integer not null check (value between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (visit_id, user_id)
);
create index visit_ratings_user_idx on public.visit_ratings(user_id);
alter table public.visits enable row level security;
alter table public.visit_ratings enable row level security;
revoke all on public.visits, public.visit_ratings from public, anon, authenticated;
grant select(id, group_id, item_id, outing_id, item_title, visited_on, note, revision, created_at) on public.visits to authenticated;
grant select on public.visit_ratings to authenticated;
create policy visits_read_member on public.visits for select to authenticated using (exists (
  select 1 from public.group_members m where m.group_id = visits.group_id and m.user_id = (select auth.uid())
));
create policy visit_ratings_read_own on public.visit_ratings for select to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.visits v where v.id = visit_ratings.visit_id)
);

create function public.record_visit(p_group_id uuid, p_item_id uuid, p_outing_id uuid, p_visited_on date, p_note text, p_rating integer, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); title_snapshot text; existing public.visits%rowtype; inserted uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  perform 1 from public.group_members where group_id = p_group_id and user_id = actor for update;
  if not found then raise exception 'membership required' using errcode = '42501'; end if;
  if p_request_id is null or p_visited_on is null or p_note is null or char_length(p_note) > 2000 or
    (p_rating is not null and p_rating not between 1 and 5) then
    raise exception 'invalid visit input' using errcode = '22023';
  end if;
  select title into title_snapshot from public.items where id = p_item_id and group_id = p_group_id;
  if not found then raise exception 'candidate unavailable' using errcode = '42501'; end if;
  -- Validate on creation only. Removing a candidate from its plan later keeps history.
  select * into existing from public.visits where id = p_request_id;
  if not found and p_outing_id is not null then
    perform 1 from public.outings where id = p_outing_id and group_id = p_group_id for update;
    if not found or not exists (select 1 from public.outing_items where outing_id = p_outing_id and item_id = p_item_id and group_id = p_group_id) then
      raise exception 'planned candidate unavailable' using errcode = '42501';
    end if;
  end if;
  insert into public.visits (id, group_id, item_id, outing_id, item_title, visited_on, note, created_by)
    values (p_request_id, p_group_id, p_item_id, p_outing_id, title_snapshot, p_visited_on, p_note, actor)
    on conflict (id) do nothing returning id into inserted;
  if inserted is null then
    select * into existing from public.visits where id = p_request_id;
    if existing.group_id is distinct from p_group_id or existing.created_by is distinct from actor or
      existing.item_id is distinct from p_item_id or existing.outing_id is distinct from p_outing_id or
      existing.visited_on is distinct from p_visited_on or existing.note is distinct from p_note then
      raise exception 'request conflict' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  if p_rating is not null then insert into public.visit_ratings(visit_id,user_id,value) values(inserted,actor,p_rating); end if;
  return inserted;
end;
$$;

create function public.update_visit(p_group_id uuid, p_visit_id uuid, p_visited_on date, p_note text, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_revision integer; next_revision integer;
begin
  if actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then raise exception 'membership required' using errcode='42501'; end if;
  select revision into current_revision from public.visits where id=p_visit_id and group_id=p_group_id for update;
  if not found then raise exception 'visit unavailable' using errcode='42501'; end if;
  if p_visited_on is null or p_note is null or char_length(p_note)>2000 then raise exception 'invalid visit input' using errcode='22023'; end if;
  if p_expected_revision is distinct from current_revision then raise exception 'visit changed' using errcode='40001'; end if;
  update public.visits set visited_on=p_visited_on, note=p_note, revision=revision+1 where id=p_visit_id returning revision into next_revision;
  return next_revision;
end;
$$;

create function public.set_visit_rating(p_group_id uuid, p_visit_id uuid, p_value integer)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  perform 1 from public.group_members where group_id=p_group_id and user_id=actor for update;
  if not found or not exists(select 1 from public.visits where id=p_visit_id and group_id=p_group_id) then raise exception 'visit unavailable' using errcode='42501'; end if;
  if p_value is not null and p_value not between 1 and 5 then raise exception 'invalid rating' using errcode='22023'; end if;
  if p_value is null then delete from public.visit_ratings where visit_id=p_visit_id and user_id=actor;
  else insert into public.visit_ratings(visit_id,user_id,value) values(p_visit_id,actor,p_value)
    on conflict(visit_id,user_id) do update set value=excluded.value,updated_at=now(); end if;
end;
$$;

create function public.get_visit_ratings(p_group_id uuid, p_visit_id uuid)
returns table (rating_count bigint, average_rating numeric, my_rating integer)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) or
    not exists(select 1 from public.visits where id=p_visit_id and group_id=p_group_id) then raise exception 'visit unavailable' using errcode='42501'; end if;
  return query select count(*),round(avg(r.value),1),max(r.value) filter(where r.user_id=actor) from public.visit_ratings r where r.visit_id=p_visit_id;
end;
$$;
revoke all on function public.record_visit(uuid,uuid,uuid,date,text,integer,uuid), public.update_visit(uuid,uuid,date,text,integer), public.set_visit_rating(uuid,uuid,integer), public.get_visit_ratings(uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_visit(uuid,uuid,uuid,date,text,integer,uuid), public.update_visit(uuid,uuid,date,text,integer), public.set_visit_rating(uuid,uuid,integer), public.get_visit_ratings(uuid,uuid) to authenticated;
commit;
