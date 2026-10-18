begin;
drop trigger guard_completed_outing on public.outings;
alter table public.outings add column end_date date, add column cancelled_at timestamptz,
 add column plan_format smallint not null default 1 check(plan_format in (1,2)),
 add column last_save_hash text, add column last_save_revision integer;
update public.outings set end_date=outing_date;
alter table public.outings alter column end_date set not null,
 add constraint outings_date_range check(end_date>=outing_date and end_date-outing_date<366);
grant select(end_date,cancelled_at,plan_format) on public.outings to authenticated;
create index outings_active_end_idx on public.outings(group_id,end_date,outing_date) where cancelled_at is null and completed_at is null;
alter table public.outing_items add column id uuid not null default gen_random_uuid(),
 add column day_index integer not null default 0 check(day_index between 0 and 365);
alter table public.outing_items drop constraint outing_items_pkey,add primary key(id);
grant select(id,day_index) on public.outing_items to authenticated;
create table public.outing_days(
 outing_id uuid not null,group_id uuid not null,day_index integer not null check(day_index between 0 and 365),
 mode text not null check(mode in ('exact','period','order')),participants uuid[] not null default '{}',
 primary key(outing_id,day_index),foreign key(outing_id,group_id) references public.outings(id,group_id) on delete restrict
);
create index outing_days_outing_group_idx on public.outing_days(outing_id,group_id);
alter table public.outing_days enable row level security;
revoke all on public.outing_days from public,anon,authenticated;
grant select on public.outing_days to authenticated;
create policy outing_days_read_member on public.outing_days for select to authenticated using(exists(select 1 from public.group_members where group_id=outing_days.group_id and user_id=(select auth.uid())));
insert into public.outing_days(outing_id,group_id,day_index,mode,participants)
 select o.id,o.group_id,0,o.mode,array(select p.user_id from public.outing_participants p where p.outing_id=o.id order by p.user_id) from public.outings o;
alter table public.visits add column outing_stop_id uuid references public.outing_items(id) on delete set null;
create index visits_outing_stop_idx on public.visits(outing_stop_id) where outing_stop_id is not null;
grant select(outing_stop_id) on public.visits to authenticated;
-- Each existing single-day item had at most one slot, so its association is unambiguous.
update public.visits v set outing_stop_id=i.id from public.outing_items i where v.outing_id=i.outing_id and v.item_id=i.item_id and not v.deleting;
alter table public.memories add column memory_end_date date;
update public.memories set memory_end_date=memory_date;
alter table public.memories alter column memory_end_date set not null;
grant select(memory_end_date) on public.memories to authenticated;

create or replace function kokoiko_private.guard_completed_outing() returns trigger language plpgsql set search_path='' as $$
begin
 if new.completed_at is not null and new.cancelled_at is not null then raise exception 'resume cancelled outing first' using errcode='22023'; end if;
 if old.completed_at is not null and new.completed_at is not null then raise exception 'undo completion before editing' using errcode='22023'; end if;
 if old.cancelled_at is not null and new.cancelled_at is not null then raise exception 'resume cancelled outing first' using errcode='22023'; end if;
 return new;
end; $$;
create trigger guard_completed_outing before update on public.outings for each row execute function kokoiko_private.guard_completed_outing();
create function kokoiko_private.sync_legacy_plan() returns trigger language plpgsql security definer set search_path='' as $$
declare plan public.outings%rowtype;
begin
 if tg_table_name='outings' then
  if new.plan_format=1 then
   if tg_op='INSERT' then update public.outings set end_date=outing_date where id=new.id and end_date<>outing_date; end if;
   insert into public.outing_days(outing_id,group_id,day_index,mode) values(new.id,new.group_id,0,new.mode)
    on conflict(outing_id,day_index) do update set mode=excluded.mode;
  end if;
 elsif tg_table_name='outing_participants' then
  if tg_op='DELETE' then select * into plan from public.outings where id=old.outing_id; else select * into plan from public.outings where id=new.outing_id; end if;
  if plan.plan_format=1 then update public.outing_days set participants=array(select user_id from public.outing_participants where outing_id=plan.id order by user_id) where outing_id=plan.id and day_index=0; end if;
 else new.memory_end_date:=(select end_date from public.outings where id=new.outing_id);return new;
 end if;
 return null;
end; $$;
revoke all on function kokoiko_private.sync_legacy_plan() from public,anon,authenticated;
create trigger sync_legacy_plan after insert or update on public.outings for each row execute function kokoiko_private.sync_legacy_plan();
create trigger sync_legacy_participants after insert or delete on public.outing_participants for each row execute function kokoiko_private.sync_legacy_plan();
create trigger memory_trip_end before insert on public.memories for each row execute function kokoiko_private.sync_legacy_plan();
-- A BEFORE default works for existing clients which do not send an end date.
create function kokoiko_private.legacy_plan_dates() returns trigger language plpgsql set search_path='' as $$
begin if new.plan_format=1 then new.end_date:=new.outing_date; end if; return new; end; $$;
revoke all on function kokoiko_private.legacy_plan_dates() from public,anon,authenticated;
create trigger legacy_plan_dates before insert or update on public.outings for each row execute function kokoiko_private.legacy_plan_dates();

alter function public.save_outing(uuid,uuid,integer,text,date,text,text,jsonb,uuid[]) rename to save_single_day;
alter function public.save_single_day(uuid,uuid,integer,text,date,text,text,jsonb,uuid[]) set schema kokoiko_private;
revoke all on function kokoiko_private.save_single_day(uuid,uuid,integer,text,date,text,text,jsonb,uuid[]) from public,anon,authenticated;
create function public.save_outing(p_group_id uuid,p_outing_id uuid,p_expected_revision integer,p_title text,p_date date,p_mode text,p_memo text,p_items jsonb,p_participants uuid[])
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'group unavailable' using errcode='42501'; end if;
 perform 1 from public.outings where id=p_outing_id and group_id=p_group_id and plan_format=2;
 if found then raise exception 'use daily plan editor' using errcode='55000'; end if;
 if jsonb_typeof(p_items)='array' then
  if jsonb_array_length(p_items)<>(select count(distinct e->>'item_id') from jsonb_array_elements(p_items) e) then raise exception 'duplicate legacy item' using errcode='23505'; end if;
  perform 1 from public.items where group_id=p_group_id and id in(select (e->>'item_id')::uuid from jsonb_array_elements(p_items) e) for share;
  if exists(select 1 from jsonb_array_elements(p_items) e join public.items i on i.id=(e->>'item_id')::uuid where i.archived_at is not null and not exists(select 1 from public.outing_items s where s.outing_id=p_outing_id and s.item_id=i.id)) then raise exception 'candidate archived' using errcode='22023'; end if;
 end if;
 return kokoiko_private.save_single_day(p_group_id,p_outing_id,p_expected_revision,p_title,p_date,p_mode,p_memo,p_items,p_participants);
end; $$;

create function public.save_trip(p_group_id uuid,p_outing_id uuid,p_expected_revision integer,p_title text,p_start date,p_end date,p_memo text,p_days jsonb,p_participants uuid[],p_removed_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.outings%rowtype; day jsonb; entry jsonb; participants uuid[];
 day_no integer:=0; position_no integer:=0; stop_id uuid; candidate_id uuid; stop_ids uuid[]:='{}';
 fingerprint text; next_revision integer; clean_title text:=btrim(p_title,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
begin
 if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform 1 from public.group_members where group_id=p_group_id and user_id=actor for update;
 if not found then raise exception 'group unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where user_id=actor) then raise exception 'display name required' using errcode='22023'; end if;
 if p_outing_id is null or p_expected_revision is null or p_expected_revision<0 or clean_title is null or char_length(clean_title) not between 1 and 120 or clean_title !~ '[^[:space:]]' or p_start is null or p_end is null or p_end<p_start or p_end-p_start>=366 or p_memo is null or char_length(p_memo)>2000 or p_days is null or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)<>p_end-p_start+1 or p_participants is null or cardinality(p_participants) not between 1 and 50 or p_removed_ids is null then raise exception 'invalid trip' using errcode='22023'; end if;
 select * into existing from public.outings where id=p_outing_id for update;
 if found and existing.group_id is distinct from p_group_id then raise exception 'outing unavailable' using errcode='42501'; end if;
 fingerprint:=md5(jsonb_build_array(clean_title,p_start,p_end,p_memo,p_days,p_participants,p_removed_ids)::text);
 if existing.id is not null and existing.last_save_hash=fingerprint and existing.last_save_revision=p_expected_revision and existing.revision=p_expected_revision+1 then return existing.revision; end if;
 if existing.id is not null and existing.revision is distinct from p_expected_revision then raise exception 'outing changed' using errcode='40001'; end if;
 if existing.completed_at is not null or existing.cancelled_at is not null then raise exception 'resume plan first' using errcode='22023'; end if;
 if existing.id is null and p_expected_revision<>0 then raise exception 'outing unavailable' using errcode='42501'; end if;
 -- Existing departed participants may be kept for history; new ones must be named current members.
 if cardinality(p_participants)<>(select count(distinct id) from unnest(p_participants) id) or exists(select 1 from unnest(p_participants) id where id is null or (not exists(select 1 from public.group_members m join public.profiles p on p.user_id=m.user_id where m.group_id=p_group_id and m.user_id=id) and not exists(select 1 from public.outing_participants old where old.outing_id=p_outing_id and old.user_id=id))) then raise exception 'participant unavailable' using errcode='42501'; end if;
 for day in select value from jsonb_array_elements(p_days) loop
  if jsonb_typeof(day)<>'object' or day->>'mode' is null or day->>'mode' not in ('exact','period','order') or jsonb_typeof(day->'items') is distinct from 'array' or jsonb_typeof(day->'participants') is distinct from 'array' then raise exception 'invalid day' using errcode='22023'; end if;
  participants:=array(select jsonb_array_elements_text(day->'participants')::uuid);
  if cardinality(participants) not between 1 and 50 or cardinality(participants)<>(select count(distinct id) from unnest(participants) id) or exists(select 1 from unnest(participants) id where id is null or (not exists(select 1 from public.group_members m join public.profiles p on p.user_id=m.user_id where m.group_id=p_group_id and m.user_id=id) and not exists(select 1 from public.outing_days old where old.outing_id=p_outing_id and id=any(old.participants)))) then raise exception 'participant unavailable' using errcode='42501'; end if;
  for entry in select value from jsonb_array_elements(day->'items') loop
   stop_id:=(entry->>'id')::uuid;candidate_id:=(entry->>'item_id')::uuid;
   if stop_id is null or candidate_id is null or stop_id=any(stop_ids) or (nullif(entry->>'planned_time','') is not null and entry->>'planned_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') or (nullif(entry->>'period','') is not null and entry->>'period' not in ('morning','noon','afternoon','night')) or (day->>'mode'='exact' and nullif(entry->>'planned_time','') is null) or (day->>'mode'='period' and nullif(entry->>'period','') is null) then raise exception 'invalid stop' using errcode='22023'; end if;
   if exists(select 1 from public.outing_items where id=stop_id and (outing_id<>p_outing_id or item_id<>((entry->>'item_id')::uuid))) then raise exception 'stop unavailable' using errcode='42501'; end if;
   perform 1 from public.items i where i.id=candidate_id and i.group_id=p_group_id and (i.archived_at is null or exists(select 1 from public.outing_items old where old.id=stop_id and old.outing_id=p_outing_id and old.item_id=i.id)) for share;
   if not found then raise exception 'candidate unavailable' using errcode='42501'; end if;
   stop_ids:=array_append(stop_ids,stop_id);
  end loop;
 end loop;
 if cardinality(stop_ids) not between 1 and 50 then raise exception 'invalid stop count' using errcode='22023'; end if;
 if cardinality(p_removed_ids)>50 or cardinality(p_removed_ids)<>(select count(distinct id) from unnest(p_removed_ids) id) or exists(select 1 from unnest(p_removed_ids) id where id is null or id=any(stop_ids)) then raise exception 'invalid removed stops' using errcode='22023'; end if;
 if existing.id is not null and p_end-p_start<existing.end_date-existing.outing_date and exists(select 1 from public.outing_items s where s.outing_id=p_outing_id and s.day_index>p_end-p_start and not(s.id=any(stop_ids)) and not(s.id=any(p_removed_ids))) then raise exception 'move or remove excluded stops first' using errcode='22023'; end if;
 if existing.id is null then
  insert into public.outings(id,group_id,title,outing_date,end_date,mode,memo,created_by,plan_format,last_save_hash,last_save_revision) values(p_outing_id,p_group_id,clean_title,p_start,p_end,p_days->0->>'mode',p_memo,actor,2,fingerprint,0) returning revision into next_revision;
 else
  update public.outings set title=clean_title,outing_date=p_start,end_date=p_end,mode=p_days->0->>'mode',memo=p_memo,plan_format=2,revision=revision+1,updated_at=now(),last_save_hash=fingerprint,last_save_revision=p_expected_revision where id=p_outing_id returning revision into next_revision;
 end if;
 -- Stable stop IDs retain the visit link through reordering and day moves.
 update public.outing_items set position=position+100000 where outing_id=p_outing_id;
 for day in select value from jsonb_array_elements(p_days) loop
  insert into public.outing_days(outing_id,group_id,day_index,mode,participants) values(p_outing_id,p_group_id,day_no,day->>'mode',array(select jsonb_array_elements_text(day->'participants')::uuid))
   on conflict(outing_id,day_index) do update set mode=excluded.mode,participants=excluded.participants;
  for entry in select value from jsonb_array_elements(day->'items') loop
   insert into public.outing_items(id,outing_id,group_id,item_id,day_index,position,planned_time,period) values((entry->>'id')::uuid,p_outing_id,p_group_id,(entry->>'item_id')::uuid,day_no,position_no,nullif(entry->>'planned_time','')::time,nullif(entry->>'period',''))
    on conflict(id) do update set day_index=excluded.day_index,position=excluded.position,planned_time=excluded.planned_time,period=excluded.period;
   position_no:=position_no+1;
  end loop;
  day_no:=day_no+1;
 end loop;
 delete from public.outing_items where outing_id=p_outing_id and not(id=any(stop_ids));
 delete from public.outing_days where outing_id=p_outing_id and day_index>=day_no;
 delete from public.outing_participants where outing_id=p_outing_id and not(user_id=any(p_participants));
 insert into public.outing_participants(outing_id,group_id,user_id) select p_outing_id,p_group_id,id from unnest(p_participants) id on conflict do nothing;
 return next_revision;
end; $$;

create function public.set_outing_cancelled(p_group_id uuid,p_outing_id uuid,p_cancelled boolean,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare plan public.outings%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
 select * into plan from public.outings where id=p_outing_id and group_id=p_group_id for update;
 if not found then raise exception 'outing unavailable' using errcode='42501'; end if;
 if p_cancelled is null or p_expected_revision is null then raise exception 'invalid cancellation' using errcode='22023'; end if;
 if (plan.cancelled_at is not null)=p_cancelled then return plan.revision; end if;
 if plan.revision<>p_expected_revision then raise exception 'outing changed' using errcode='40001'; end if;
 if plan.completed_at is not null then raise exception 'undo completion first' using errcode='22023'; end if;
 update public.outings set cancelled_at=case when p_cancelled then now() else null end,revision=revision+1,updated_at=now() where id=p_outing_id returning revision into plan.revision;
 return plan.revision;
end; $$;
create function public.record_stop_visit(p_group_id uuid,p_item_id uuid,p_outing_id uuid,p_stop_id uuid,p_visited_on date,p_note text,p_rating integer,p_request_id uuid,p_time text,p_period text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;existing public.visits%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
 if p_stop_id is not null and not exists(select 1 from public.outing_items where id=p_stop_id and outing_id=p_outing_id and item_id=p_item_id and group_id=p_group_id) then raise exception 'stop unavailable' using errcode='42501'; end if;
 select * into existing from public.visits where id=p_request_id;
 if found and existing.outing_stop_id is distinct from p_stop_id then raise exception 'request conflict' using errcode='23505'; end if;
 result:=public.record_timed_visit(p_group_id,p_item_id,p_outing_id,p_visited_on,p_note,p_rating,p_request_id,p_time,p_period);
 if existing.id is null then update public.visits set outing_stop_id=p_stop_id where id=result; end if;
 return result;
end; $$;
revoke all on function public.save_outing(uuid,uuid,integer,text,date,text,text,jsonb,uuid[]),public.save_trip(uuid,uuid,integer,text,date,date,text,jsonb,uuid[],uuid[]),public.set_outing_cancelled(uuid,uuid,boolean,integer),public.record_stop_visit(uuid,uuid,uuid,uuid,date,text,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_outing(uuid,uuid,integer,text,date,text,text,jsonb,uuid[]),public.save_trip(uuid,uuid,integer,text,date,date,text,jsonb,uuid[],uuid[]),public.set_outing_cancelled(uuid,uuid,boolean,integer),public.record_stop_visit(uuid,uuid,uuid,uuid,date,text,integer,uuid,text,text) to authenticated;
commit;
