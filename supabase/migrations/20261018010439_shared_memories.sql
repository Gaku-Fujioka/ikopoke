begin;
alter table public.visits add column visited_time time,
  add column visited_period text check(visited_period in ('morning','noon','afternoon','night')),
  add constraint visits_time_choice check(visited_time is null or visited_period is null),
  add constraint visits_time_minutes check(visited_time is null or (visited_time < time '24:00' and extract(second from visited_time)=0));
grant select(visited_time,visited_period) on public.visits to authenticated;
alter table public.outings add column completed_at timestamptz;
grant select(completed_at) on public.outings to authenticated;

create table public.memories(
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  outing_id uuid not null unique,
  title text not null check(char_length(title) between 1 and 120 and title ~ '[^[:space:]]'),
  memory_date date not null,
  note text not null check(char_length(note)<=2000),
  revision integer not null default 1 check(revision>0),
  created_at timestamptz not null default now(),
  foreign key(outing_id,group_id) references public.outings(id,group_id) on delete restrict
);
create index memories_outing_group_idx on public.memories(outing_id,group_id);
create index memories_group_date_idx on public.memories(group_id,memory_date desc,id);
alter table public.memories enable row level security;
revoke all on public.memories from public,anon,authenticated;
grant select on public.memories to authenticated;
create policy memories_read_member on public.memories for select to authenticated using(exists(
  select 1 from public.group_members m where m.group_id=memories.group_id and m.user_id=(select auth.uid())
));

-- Keep the original RPCs available for older clients. New entry points add optional time atomically.
create function public.record_timed_visit(p_group_id uuid,p_item_id uuid,p_outing_id uuid,p_visited_on date,p_note text,p_rating integer,p_request_id uuid,p_time text,p_period text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.visits%rowtype; result uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  perform 1 from public.group_members where group_id=p_group_id and user_id=actor for update;
  if not found then raise exception 'membership required' using errcode='42501'; end if;
  if (p_time is not null and p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') or
    (p_period is not null and p_period not in ('morning','noon','afternoon','night')) or
    (p_time is not null and p_period is not null) then raise exception 'invalid visit time' using errcode='22023'; end if;
  select * into existing from public.visits where id=p_request_id;
  if found and (existing.visited_time is distinct from p_time::time or existing.visited_period is distinct from p_period) then
    raise exception 'request conflict' using errcode='23505';
  end if;
  result:=public.record_visit(p_group_id,p_item_id,p_outing_id,p_visited_on,p_note,p_rating,p_request_id);
  if existing.id is null then update public.visits set visited_time=p_time::time,visited_period=p_period where id=result; end if;
  return result;
end; $$;
create function public.update_timed_visit(p_group_id uuid,p_visit_id uuid,p_visited_on date,p_note text,p_expected_revision integer,p_time text,p_period text)
returns integer language plpgsql security definer set search_path='' as $$
declare result integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  if (p_time is not null and p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') or
    (p_period is not null and p_period not in ('morning','noon','afternoon','night')) or
    (p_time is not null and p_period is not null) then raise exception 'invalid visit time' using errcode='22023'; end if;
  result:=public.update_visit(p_group_id,p_visit_id,p_visited_on,p_note,p_expected_revision);
  update public.visits set visited_time=p_time::time,visited_period=p_period where id=p_visit_id and group_id=p_group_id;
  return result;
end; $$;

create function kokoiko_private.guard_completed_outing() returns trigger language plpgsql set search_path='' as $$
begin
  if old.completed_at is not null and new.completed_at is not null then
    raise exception 'undo completion before editing' using errcode='22023';
  end if;
  return new;
end; $$;
revoke all on function kokoiko_private.guard_completed_outing() from public,anon,authenticated;
create trigger guard_completed_outing before update on public.outings for each row execute function kokoiko_private.guard_completed_outing();

create function public.set_outing_completed(p_group_id uuid,p_outing_id uuid,p_completed boolean,p_expected_revision integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_outing public.outings%rowtype; memory_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then raise exception 'membership required' using errcode='42501'; end if;
  if p_completed is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'invalid completion input' using errcode='22023'; end if;
  select * into current_outing from public.outings where id=p_outing_id and group_id=p_group_id for update;
  if not found then raise exception 'outing unavailable' using errcode='42501'; end if;
  if (current_outing.completed_at is not null)=p_completed and current_outing.revision in (p_expected_revision,p_expected_revision+1) then
    select id into memory_id from public.memories where outing_id=p_outing_id; return memory_id;
  end if;
  if current_outing.revision is distinct from p_expected_revision then raise exception 'outing changed' using errcode='40001'; end if;
  update public.outings set completed_at=case when p_completed then now() else null end,revision=revision+1,updated_at=now() where id=p_outing_id;
  if p_completed then
    insert into public.memories(group_id,outing_id,title,memory_date,note)
      values(p_group_id,p_outing_id,current_outing.title,current_outing.outing_date,current_outing.memo)
      on conflict(outing_id) do nothing;
  end if;
  select id into memory_id from public.memories where outing_id=p_outing_id; return memory_id;
end; $$;

create function public.update_memory(p_group_id uuid,p_memory_id uuid,p_title text,p_note text,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_revision integer; result integer;
  clean_title text:=btrim(p_title,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  if clean_title is null or char_length(clean_title) not between 1 and 120 or clean_title !~ '[^[:space:]]' or p_note is null or char_length(p_note)>2000 then raise exception 'invalid memory input' using errcode='22023'; end if;
  select revision into current_revision from public.memories where id=p_memory_id and group_id=p_group_id for update;
  if not found then raise exception 'memory unavailable' using errcode='42501'; end if;
  if p_expected_revision is distinct from current_revision then raise exception 'memory changed' using errcode='40001'; end if;
  update public.memories set title=clean_title,note=p_note,revision=revision+1 where id=p_memory_id returning revision into result;
  return result;
end; $$;
revoke all on function public.record_timed_visit(uuid,uuid,uuid,date,text,integer,uuid,text,text),public.update_timed_visit(uuid,uuid,date,text,integer,text,text),public.set_outing_completed(uuid,uuid,boolean,integer),public.update_memory(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.record_timed_visit(uuid,uuid,uuid,date,text,integer,uuid,text,text),public.update_timed_visit(uuid,uuid,date,text,integer,text,text),public.set_outing_completed(uuid,uuid,boolean,integer),public.update_memory(uuid,uuid,text,text,integer) to authenticated;
commit;
