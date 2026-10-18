begin;
alter table public.groups add column deleting boolean not null default false;
grant select(deleting) on public.groups to authenticated;
-- Participation remains historical after a member leaves. Names are resolved
-- only through current group membership; the Auth identity is soft deleted.
alter table public.outing_participants drop constraint outing_participants_group_id_user_id_fkey;
create table kokoiko_private.account_deletions(
 user_id uuid primary key references auth.users(id) on delete restrict,
 request_id uuid not null,state text not null check(state in ('pending','data_removed','complete')),
 group_ids uuid[] not null,delete_group_ids uuid[] not null,created_at timestamptz not null default now()
);
revoke all on kokoiko_private.account_deletions from public,anon,authenticated;
create function kokoiko_private.account_active(p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$select p_actor is not null and not exists(select 1 from kokoiko_private.account_deletions where user_id=p_actor)$$;
revoke all on function kokoiko_private.account_active(uuid) from public,anon,authenticated;

-- Every old and new write path shares the same lifecycle guard. The advisory
-- lock also serializes a departing account against in-flight uploads/creates.
create function kokoiko_private.guard_group_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();gid uuid;old_json jsonb;new_json jsonb;group_exists boolean;
begin
 new_json:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if actor is not null then
  perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
  if not kokoiko_private.account_active(actor) then raise exception 'account removal in progress' using errcode='55000'; end if;
 end if;
 if tg_table_name='profiles' then if tg_op='DELETE' then return old; end if; return new; end if;
 gid:=case when tg_table_name='groups' then (new_json->>'id')::uuid else (new_json->>'group_id')::uuid end;
 if gid is null and tg_table_name in ('item_comments','item_reactions') then select group_id into gid from public.items where id=(new_json->>'item_id')::uuid; end if;
 if gid is null and tg_table_name='visit_ratings' then select group_id into gid from public.visits where id=(new_json->>'visit_id')::uuid; end if;
 perform 1 from public.groups where id=gid for share;
 group_exists:=found;
 if exists(select 1 from public.groups where id=gid and deleting) then
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' and tg_table_name='visit_photos' then
   if new_json->>'status'='cancelling' then return new; end if;
  end if;
  if tg_op='UPDATE' and tg_table_name='memories' then
   old_json:=to_jsonb(old);
   if new_json->>'cover_photo_id' is null and (new_json-'cover_photo_id')=(old_json-'cover_photo_id') then return new; end if;
  end if;
  raise exception 'group removal in progress' using errcode='55000';
 end if;
 if actor is not null and group_exists and not(tg_table_name='group_members' and tg_op='INSERT' and (new_json->>'user_id')::uuid=actor) then
  perform 1 from public.group_members where group_id=gid and user_id=actor for share;
  if not found then raise exception 'membership required' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function kokoiko_private.guard_group_write() from public,anon,authenticated;
do $$declare table_name text;begin
 foreach table_name in array array['groups','group_members','group_invites','items','item_comments','item_reactions','lists','item_list_memberships','outings','outing_items','outing_days','outing_participants','visits','visit_ratings','visit_photos','memories','profiles'] loop
  execute format('create trigger lifecycle_write_guard before insert or update or delete on public.%I for each row execute function kokoiko_private.guard_group_write()',table_name);
 end loop;
end; $$;
create or replace function kokoiko_private.can_upload_visit_photo(p_path text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();photo public.visit_photos%rowtype;
begin
 if actor is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
 if not kokoiko_private.account_active(actor) then return false; end if;
 select * into photo from public.visit_photos where object_path=p_path;
 if not found then return false; end if;
 perform 1 from public.groups where id=photo.group_id and not deleting for share;
 if not found then return false; end if;
 select * into photo from public.visit_photos where object_path=p_path for share;
 return found and photo.status='pending' and photo.created_by=actor and exists(select 1 from public.visits where id=photo.visit_id and not deleting) and exists(select 1 from public.group_members where group_id=photo.group_id and user_id=actor);
end; $$;
create function kokoiko_private.former_group_author(p_group_id uuid,p_author uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) and not exists(select 1 from public.group_members where group_id=p_group_id and user_id=p_author)
$$;
revoke all on function kokoiko_private.former_group_author(uuid,uuid) from public,anon,authenticated;
grant execute on function kokoiko_private.former_group_author(uuid,uuid) to authenticated;
drop policy visit_photos_read_member on public.visit_photos;
create policy visit_photos_read_member on public.visit_photos for select to authenticated using (
 exists(select 1 from public.group_members m where m.group_id=visit_photos.group_id and m.user_id=(select auth.uid())) and
 (status='ready' or created_by=(select auth.uid()) or deletion_actor=(select auth.uid()) or kokoiko_private.former_group_author(group_id,created_by))
);

create function kokoiko_private.delete_group_data(p_group_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.visit_photos p join storage.objects o on o.bucket_id='visit-photos' and o.name=p.object_path where p.group_id=p_group_id) then raise exception 'photo removal incomplete' using errcode='55000'; end if;
 delete from public.memories where group_id=p_group_id;
 delete from public.visit_photos where group_id=p_group_id;
 delete from public.visit_ratings where visit_id in(select id from public.visits where group_id=p_group_id);
 delete from public.visits where group_id=p_group_id;
 delete from public.outing_days where group_id=p_group_id;
 delete from public.outing_participants where group_id=p_group_id;
 delete from public.outing_items where group_id=p_group_id;
 delete from public.outings where group_id=p_group_id;
 delete from public.item_list_memberships where group_id=p_group_id;
 delete from public.lists where group_id=p_group_id;
 delete from public.item_comments where item_id in(select id from public.items where group_id=p_group_id);
 delete from public.item_reactions where item_id in(select id from public.items where group_id=p_group_id);
 delete from public.items where group_id=p_group_id;
 delete from public.group_invites where group_id=p_group_id;
 delete from public.group_members where group_id=p_group_id;
 delete from public.groups where id=p_group_id;
end; $$;
revoke all on function kokoiko_private.delete_group_data(uuid) from public,anon,authenticated;

create function public.get_my_group_departures()
returns table(group_id uuid,name text,member_count bigint,deleting boolean)
language sql stable security definer set search_path='' as $$
 select g.id,g.name,(select count(*) from public.group_members m where m.group_id=g.id),g.deleting from public.groups g join public.group_members own on own.group_id=g.id and own.user_id=auth.uid() order by g.id
$$;
create function public.begin_leave_group(p_group_id uuid,p_expected_members integer,p_delete_last boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();members integer;
begin
 if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
 if not kokoiko_private.account_active(actor) then raise exception 'account removal in progress' using errcode='55000'; end if;
 perform 1 from public.groups where id=p_group_id for update;
 if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then return false; end if;
 select count(*) into members from public.group_members where group_id=p_group_id;
 if p_expected_members is distinct from members then raise exception 'membership changed' using errcode='40001'; end if;
 if members=1 then
  if p_delete_last is distinct from true then raise exception 'confirm whole group removal' using errcode='22023'; end if;
  update public.groups set deleting=true where id=p_group_id and not deleting;
  update public.visit_photos set status='cancelling',deletion_actor=actor where group_id=p_group_id;
  return true;
 end if;
 -- A late upload cannot complete after departure. Ready shared files remain.
 update public.visit_photos set status='cancelling' where group_id=p_group_id and created_by=actor and status<>'ready';
 delete from public.group_members where group_id=p_group_id and user_id=actor;
 return false;
end; $$;
create function public.get_group_cleanup_paths(p_group_id uuid)
returns table(object_path text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.groups g join public.group_members m on m.group_id=g.id where g.id=p_group_id and g.deleting and m.user_id=auth.uid()) or (select count(*) from public.group_members where group_id=p_group_id)<>1 then raise exception 'group unavailable' using errcode='42501'; end if;
 return query select p.object_path from public.visit_photos p join storage.objects o on o.name=p.object_path and o.bucket_id='visit-photos' where p.group_id=p_group_id order by p.id limit 1000;
end; $$;
create function public.finish_leave_group(p_group_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform 1 from public.groups where id=p_group_id for update;
 if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then return; end if;
 if not exists(select 1 from public.groups where id=p_group_id and deleting) or (select count(*) from public.group_members where group_id=p_group_id)<>1 then raise exception 'group unavailable' using errcode='42501'; end if;
 perform kokoiko_private.delete_group_data(p_group_id);
end; $$;
create function public.get_my_account_deletion()
returns table(request_id uuid,state text,group_ids uuid[],delete_group_ids uuid[])
language sql stable security definer set search_path='' as $$select request_id,state,group_ids,delete_group_ids from kokoiko_private.account_deletions where user_id=auth.uid()$$;

-- Only the verified server function may call these Auth-adjacent operations.
create function public.prepare_account_deletion(p_user_id uuid,p_request_id uuid,p_group_ids uuid[],p_delete_group_ids uuid[])
returns text language plpgsql security definer set search_path='' as $$
declare job kokoiko_private.account_deletions%rowtype;actual uuid[];solo uuid[];gid uuid;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'server only' using errcode='42501'; end if;
 if p_user_id is null or p_request_id is null or p_group_ids is null or p_delete_group_ids is null then raise exception 'invalid deletion' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,702101));
 select * into job from kokoiko_private.account_deletions where user_id=p_user_id for update;
 if found then
  if job.request_id<>p_request_id then raise exception 'another removal request exists' using errcode='40001'; end if;
  if job.state<>'complete' and (job.group_ids is distinct from array(select id from unnest(p_group_ids) id order by id) or job.delete_group_ids is distinct from array(select id from unnest(p_delete_group_ids) id order by id)) then raise exception 'removal confirmation changed' using errcode='40001'; end if;
  return job.state;
 end if;
 perform 1 from public.groups where id in(select group_id from public.group_members where user_id=p_user_id) order by id for update;
 select coalesce(array_agg(group_id order by group_id),'{}'::uuid[]) into actual from public.group_members where user_id=p_user_id;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into solo from public.groups where id=any(actual) and (select count(*) from public.group_members where group_id=groups.id)=1;
 if actual is distinct from array(select id from unnest(p_group_ids) id order by id) or solo is distinct from array(select id from unnest(p_delete_group_ids) id order by id) then raise exception 'membership changed' using errcode='40001'; end if;
 insert into kokoiko_private.account_deletions(user_id,request_id,state,group_ids,delete_group_ids) values(p_user_id,p_request_id,'pending',actual,solo);
 foreach gid in array actual loop
  if gid=any(solo) then
   update public.groups set deleting=true where id=gid and not deleting;
   update public.visit_photos set status='cancelling',deletion_actor=p_user_id where group_id=gid;
  else
   update public.visit_photos set status='cancelling' where group_id=gid and created_by=p_user_id and status<>'ready';
   delete from public.group_members where group_id=gid and user_id=p_user_id;
  end if;
 end loop;
 update public.profiles set display_name='退出したメンバー',updated_at=now() where user_id=p_user_id;
 return 'pending';
end; $$;
create function public.get_account_cleanup_paths(p_user_id uuid,p_request_id uuid)
returns table(object_path text) language plpgsql stable security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'service_role' then raise exception 'server only' using errcode='42501'; end if;
 if not exists(select 1 from kokoiko_private.account_deletions where user_id=p_user_id and request_id=p_request_id) then raise exception 'removal unavailable' using errcode='42501'; end if;
 return query select p.object_path from public.visit_photos p join storage.objects o on o.name=p.object_path and o.bucket_id='visit-photos' join kokoiko_private.account_deletions j on j.user_id=p_user_id and p.group_id=any(j.delete_group_ids) order by p.id limit 1000;
end; $$;
create function public.finish_account_data(p_user_id uuid,p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare job kokoiko_private.account_deletions%rowtype;gid uuid;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'server only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,702101));
 select * into job from kokoiko_private.account_deletions where user_id=p_user_id and request_id=p_request_id for update;
 if not found then raise exception 'removal unavailable' using errcode='42501'; end if;
 if job.state in ('data_removed','complete') then return; end if;
 foreach gid in array job.delete_group_ids loop
  perform 1 from public.groups where id=gid for update;
  if found then
   if (select count(*) from public.group_members where group_id=gid)<>1 or not exists(select 1 from public.group_members where group_id=gid and user_id=p_user_id) then raise exception 'membership changed' using errcode='40001'; end if;
   perform kokoiko_private.delete_group_data(gid);
  end if;
 end loop;
 if exists(select 1 from public.group_members where user_id=p_user_id) then raise exception 'membership changed' using errcode='40001'; end if;
 update kokoiko_private.account_deletions set state='data_removed' where user_id=p_user_id;
end; $$;
create function public.complete_account_deletion(p_user_id uuid,p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'service_role' then raise exception 'server only' using errcode='42501'; end if;
 update kokoiko_private.account_deletions set state='complete',group_ids='{}',delete_group_ids='{}' where user_id=p_user_id and request_id=p_request_id and state='data_removed';
end; $$;

create or replace function public.get_home_activity(
  p_group_id uuid default null, p_limit integer default 13,
  p_before_at timestamptz default null, p_before_key text default null
)
returns table (
  event_key text, group_id uuid, kind text, subject_id uuid, title text,
  actor_name text, is_mine boolean, occurred_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_group_id is not null and not exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = actor
  ) then raise exception 'group unavailable' using errcode = '42501'; end if;
  if p_limit is null or p_limit not between 1 and 41
    or (p_before_at is null) <> (p_before_key is null)
    or (p_before_key is not null and p_before_key !~ '^[a-f0-9]{32}$')
  then raise exception 'invalid page' using errcode = '22023'; end if;

  return query
  with allowed as materialized (
    select m.group_id from public.group_members m
    where m.user_id = actor and (p_group_id is null or m.group_id = p_group_id)
  ), events as (
    select md5('item:' || i.id::text) k, i.group_id g, 'item'::text t,
      i.id subject, i.title label, i.created_by who, i.created_at at
      from public.items i join allowed a on a.group_id = i.group_id
    union all
    select md5('reaction:' || r.item_id::text || ':' || r.user_id::text), i.group_id, r.value,
      i.id, i.title, r.user_id, r.updated_at
      from public.item_reactions r join public.items i on i.id = r.item_id join allowed a on a.group_id = i.group_id
    union all
    select md5('comment:' || c.id::text), i.group_id, 'comment', i.id, i.title, c.created_by, c.created_at
      from public.item_comments c join public.items i on i.id = c.item_id join allowed a on a.group_id = i.group_id
    union all
    select md5('outing:' || o.id::text), o.group_id, 'outing', o.id, o.title, o.created_by, o.created_at
      from public.outings o join allowed a on a.group_id = o.group_id
    union all
    select md5('visit:' || v.id::text), v.group_id, 'visit', v.id, v.item_title, v.created_by, v.created_at
      from public.visits v join allowed a on a.group_id = v.group_id
    union all
    select md5('memory:' || m.id::text), m.group_id, 'memory', m.id, m.title, null::uuid, m.created_at
      from public.memories m join allowed a on a.group_id = m.group_id
  ), page as (
    select e.* from events e
    where p_before_at is null or (e.at, e.k) < (p_before_at, p_before_key)
    order by e.at desc, e.k desc limit p_limit
  )
  select e.k, e.g, e.t, e.subject, e.label, case when e.who is not null and member.user_id is null then '退出したメンバー' else p.display_name end,
    coalesce(e.who = actor, false), e.at
    from page e
    -- Do not disclose a former member's current account profile.
    left join public.group_members member on member.group_id = e.g and member.user_id = e.who
    left join public.profiles p on p.user_id = member.user_id
    order by e.at desc, e.k desc;
end;
$$;

revoke all on function public.get_my_group_departures(),public.begin_leave_group(uuid,integer,boolean),public.get_group_cleanup_paths(uuid),public.finish_leave_group(uuid),public.get_my_account_deletion() from public,anon,authenticated;
grant execute on function public.get_my_group_departures(),public.begin_leave_group(uuid,integer,boolean),public.get_group_cleanup_paths(uuid),public.finish_leave_group(uuid),public.get_my_account_deletion() to authenticated;
revoke all on function public.prepare_account_deletion(uuid,uuid,uuid[],uuid[]),public.get_account_cleanup_paths(uuid,uuid),public.finish_account_data(uuid,uuid),public.complete_account_deletion(uuid,uuid) from public,anon,authenticated;
-- Some local policy-test fixtures intentionally have only the two client roles.
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then
 grant execute on function public.prepare_account_deletion(uuid,uuid,uuid[],uuid[]),public.get_account_cleanup_paths(uuid,uuid),public.finish_account_data(uuid,uuid),public.complete_account_deletion(uuid,uuid) to service_role;
end if;end; $$;
commit;
