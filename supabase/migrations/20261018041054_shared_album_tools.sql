begin;
alter table public.visits add column deleting boolean not null default false;
grant select(deleting) on public.visits to authenticated;
alter table public.visit_photos add column display_order integer not null default 0,
  add column deletion_actor uuid references auth.users(id) on delete restrict;
update public.visit_photos set display_order=slot;
create index visit_photos_deletion_actor_idx on public.visit_photos(deletion_actor) where deletion_actor is not null;
grant select(display_order) on public.visit_photos to authenticated;
alter table public.memories add column cover_photo_id uuid references public.visit_photos(id) on delete set null;
create index memories_cover_photo_idx on public.memories(cover_photo_id) where cover_photo_id is not null;
grant select(cover_photo_id) on public.memories to authenticated;

create function kokoiko_private.guard_visit_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='visits' then
    if old.deleting and new is distinct from old then raise exception 'visit removal in progress' using errcode='55000'; end if;
  else
    perform 1 from public.visits where id=new.visit_id and not deleting for update;
    if not found then
      if tg_op='UPDATE' and tg_table_name='visit_photos' then
        if new.status<>'cancelling' then raise exception 'visit removal in progress' using errcode='55000'; end if;
      else raise exception 'visit removal in progress' using errcode='55000'; end if;
    end if;
    if tg_table_name='visit_photos' and tg_op='INSERT' then
      select coalesce(max(display_order),0)+1 into new.display_order from public.visit_photos where visit_id=new.visit_id;
    end if;
    if tg_table_name='visit_photos' and tg_op='UPDATE' then
      if old.status='pending' and new.status='ready' then
        select coalesce(max(display_order),0)+1 into new.display_order from public.visit_photos where visit_id=new.visit_id and id<>new.id;
      end if;
    end if;
  end if;
  return new;
end; $$;
revoke all on function kokoiko_private.guard_visit_changes() from public,anon,authenticated;
create trigger guard_visit_changes before update on public.visits for each row execute function kokoiko_private.guard_visit_changes();
create trigger guard_photo_changes before insert or update on public.visit_photos for each row execute function kokoiko_private.guard_visit_changes();
create trigger guard_rating_changes before insert or update on public.visit_ratings for each row execute function kokoiko_private.guard_visit_changes();

drop policy visit_photos_read_member on public.visit_photos;
create policy visit_photos_read_member on public.visit_photos for select to authenticated using (
  (status='ready' or created_by=(select auth.uid()) or deletion_actor=(select auth.uid())) and exists (
    select 1 from public.group_members m where m.group_id=visit_photos.group_id and m.user_id=(select auth.uid())
  )
);
create function public.get_visit_permissions(p_group_id uuid,p_visit_id uuid)
returns table(can_delete boolean,photo_ids uuid[]) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  return query select (v.created_by=auth.uid() or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=v.created_by)),
    array(select p.id from public.visit_photos p where p.visit_id=v.id and (p.created_by=auth.uid() or p.deletion_actor=auth.uid() or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=p.created_by)))
    from public.visits v where v.id=p_visit_id and v.group_id=p_group_id;
end; $$;

create function public.reorder_visit_photos(p_group_id uuid,p_visit_id uuid,p_ids uuid[],p_expected_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare current_ids uuid[];
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  perform 1 from public.visits where id=p_visit_id and group_id=p_group_id and not deleting for update;
  if not found then raise exception 'visit unavailable' using errcode='42501'; end if;
  select coalesce(array_agg(id order by display_order,id),'{}'::uuid[]) into current_ids from public.visit_photos where visit_id=p_visit_id and status='ready';
  if p_ids is null or cardinality(p_ids)>10 or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id) or
    not (p_ids @> current_ids and current_ids @> p_ids) then raise exception 'invalid photo order' using errcode='22023'; end if;
  if current_ids=p_ids then return; end if;
  if current_ids is distinct from p_expected_ids then raise exception 'photos changed' using errcode='40001'; end if;
  update public.visit_photos p set display_order=ordered.n from unnest(p_ids) with ordinality ordered(id,n) where p.id=ordered.id;
end; $$;

create function public.set_memory_cover(p_group_id uuid,p_memory_id uuid,p_photo_id uuid,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare memory public.memories%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  select * into memory from public.memories where id=p_memory_id and group_id=p_group_id for update;
  if not found then raise exception 'album unavailable' using errcode='42501'; end if;
  if memory.cover_photo_id is not distinct from p_photo_id then return memory.revision; end if;
  if memory.revision is distinct from p_expected_revision then raise exception 'album changed' using errcode='40001'; end if;
  if p_photo_id is not null then
    perform 1 from public.visit_photos p join public.visits v on v.id=p.visit_id where p.id=p_photo_id and p.group_id=p_group_id and p.status='ready' and not v.deleting and v.outing_id=memory.outing_id for share of p;
    if not found then raise exception 'photo unavailable' using errcode='42501'; end if;
  end if;
  update public.memories set cover_photo_id=p_photo_id,revision=revision+1 where id=p_memory_id returning revision into memory.revision;
  return memory.revision;
end; $$;

create function public.begin_remove_photo(p_group_id uuid,p_visit_id uuid,p_photo_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare photo public.visit_photos%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  perform 1 from public.visits where id=p_visit_id and group_id=p_group_id for update;
  if not found then raise exception 'visit unavailable' using errcode='42501'; end if;
  select * into photo from public.visit_photos where id=p_photo_id and visit_id=p_visit_id and group_id=p_group_id for update;
  if not found then return null; end if;
  if photo.created_by is distinct from auth.uid() and photo.deletion_actor is distinct from auth.uid() and exists(select 1 from public.group_members where group_id=p_group_id and user_id=photo.created_by) then raise exception 'photo unavailable' using errcode='42501'; end if;
  update public.visit_photos set status='cancelling',deletion_actor=auth.uid() where id=p_photo_id;
  return photo.object_path;
end; $$;
create function public.finish_remove_photo(p_group_id uuid,p_visit_id uuid,p_photo_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare photo public.visit_photos%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  perform 1 from public.visits where id=p_visit_id and group_id=p_group_id for update;
  select * into photo from public.visit_photos where id=p_photo_id and visit_id=p_visit_id and group_id=p_group_id for update;
  if not found then return; end if;
  if photo.status<>'cancelling' or (photo.created_by is distinct from auth.uid() and photo.deletion_actor is distinct from auth.uid() and exists(select 1 from public.group_members where group_id=p_group_id and user_id=photo.created_by)) then raise exception 'photo unavailable' using errcode='42501'; end if;
  if exists(select 1 from storage.objects where bucket_id='visit-photos' and name=photo.object_path) then raise exception 'photo removal incomplete' using errcode='55000'; end if;
  delete from public.visit_photos where id=p_photo_id;
end; $$;
create function public.begin_remove_visit(p_group_id uuid,p_visit_id uuid,p_expected_revision integer)
returns table(object_path text) language plpgsql security definer set search_path='' as $$
declare visit public.visits%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  select * into visit from public.visits where id=p_visit_id and group_id=p_group_id for update;
  if not found then return; end if;
  if visit.created_by is distinct from auth.uid() and exists(select 1 from public.group_members where group_id=p_group_id and user_id=visit.created_by) then raise exception 'visit unavailable' using errcode='42501'; end if;
  if visit.revision is distinct from p_expected_revision then raise exception 'visit changed' using errcode='40001'; end if;
  if not visit.deleting then update public.visits set deleting=true where id=p_visit_id; end if;
  -- Row locks also wait for an upload already inside Storage's INSERT policy.
  update public.visit_photos set status='cancelling',deletion_actor=auth.uid() where visit_id=p_visit_id;
  return query select p.object_path from public.visit_photos p where p.visit_id=p_visit_id;
end; $$;
create function public.finish_remove_visit(p_group_id uuid,p_visit_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare visit public.visits%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  select * into visit from public.visits where id=p_visit_id and group_id=p_group_id for update;
  if not found then return; end if;
  if not visit.deleting or (visit.created_by is distinct from auth.uid() and exists(select 1 from public.group_members where group_id=p_group_id and user_id=visit.created_by)) then raise exception 'visit unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.visit_photos p join storage.objects o on o.bucket_id='visit-photos' and o.name=p.object_path where p.visit_id=p_visit_id) then raise exception 'photo removal incomplete' using errcode='55000'; end if;
  delete from public.visit_photos where visit_id=p_visit_id;
  delete from public.visit_ratings where visit_id=p_visit_id;
  delete from public.visits where id=p_visit_id;
end; $$;
revoke all on function public.get_visit_permissions(uuid,uuid),public.reorder_visit_photos(uuid,uuid,uuid[],uuid[]),public.set_memory_cover(uuid,uuid,uuid,integer),
 public.begin_remove_photo(uuid,uuid,uuid),public.finish_remove_photo(uuid,uuid,uuid),public.begin_remove_visit(uuid,uuid,integer),public.finish_remove_visit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_visit_permissions(uuid,uuid),public.reorder_visit_photos(uuid,uuid,uuid[],uuid[]),public.set_memory_cover(uuid,uuid,uuid,integer),
 public.begin_remove_photo(uuid,uuid,uuid),public.finish_remove_photo(uuid,uuid,uuid),public.begin_remove_visit(uuid,uuid,integer),public.finish_remove_visit(uuid,uuid) to authenticated;
commit;
