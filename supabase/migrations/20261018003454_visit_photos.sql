begin;
create table public.visit_photos (
  id uuid primary key,
  group_id uuid not null,
  visit_id uuid not null,
  slot smallint not null check(slot between 1 and 10),
  object_path text not null unique,
  content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check(byte_size between 1 and 10485760),
  status text not null default 'pending' check(status in ('pending','ready','cancelling')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(visit_id,slot),
  foreign key(visit_id,group_id) references public.visits(id,group_id) on delete restrict
);
create index visit_photos_visit_group_idx on public.visit_photos(visit_id,group_id);
create index visit_photos_created_by_idx on public.visit_photos(created_by);
alter table public.visit_photos enable row level security;
revoke all on public.visit_photos from public,anon,authenticated;
grant select(id,group_id,visit_id,slot,object_path,content_type,byte_size,status,created_at) on public.visit_photos to authenticated;
create policy visit_photos_read_member on public.visit_photos for select to authenticated using (
  (status='ready' or created_by=(select auth.uid())) and exists (
    select 1 from public.group_members m where m.group_id=visit_photos.group_id and m.user_id=(select auth.uid())
  )
);

-- Bucket creation via SQL is documented by Supabase. Object bytes and removal
-- always go through the Storage API; never edit storage.objects metadata here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('visit-photos','visit-photos',false,10485760,array['image/jpeg','image/png','image/webp']);

create function public.reserve_visit_photo(p_group_id uuid,p_visit_id uuid,p_request_id uuid,p_content_type text,p_byte_size integer)
returns table(photo_id uuid,object_path text,status text)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.visit_photos%rowtype; free_slot integer; extension text; path text;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then raise exception 'membership required' using errcode='42501'; end if;
  perform 1 from public.visits where id=p_visit_id and group_id=p_group_id for update;
  if not found then raise exception 'visit unavailable' using errcode='42501'; end if;
  if p_request_id is null or p_content_type is null or p_content_type not in ('image/jpeg','image/png','image/webp') or p_byte_size is null or p_byte_size not between 1 and 10485760 then
    raise exception 'invalid photo input' using errcode='22023'; end if;
  select * into existing from public.visit_photos where id=p_request_id;
  if found then
    if existing.visit_id is distinct from p_visit_id or existing.group_id is distinct from p_group_id or existing.created_by is distinct from actor or existing.content_type is distinct from p_content_type or existing.byte_size is distinct from p_byte_size then
      raise exception 'request conflict' using errcode='23505'; end if;
    return query select existing.id,existing.object_path,existing.status; return;
  end if;
  select s into free_slot from generate_series(1,10) s where not exists(select 1 from public.visit_photos p where p.visit_id=p_visit_id and p.slot=s) order by s limit 1;
  if free_slot is null then raise exception 'photo limit reached' using errcode='54000'; end if;
  extension:=case p_content_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  path:=p_group_id::text||'/'||p_visit_id::text||'/'||p_request_id::text||'.'||extension;
  insert into public.visit_photos(id,group_id,visit_id,slot,object_path,content_type,byte_size,created_by)
    values(p_request_id,p_group_id,p_visit_id,free_slot,path,p_content_type,p_byte_size,actor);
  return query select p_request_id,path,'pending'::text;
end;
$$;

-- Lock the reservation during Storage's INSERT transaction. Cancellation waits
-- for an in-flight upload, so it cannot leave an untracked late-arriving object.
create function kokoiko_private.can_upload_visit_photo(p_path text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); photo public.visit_photos%rowtype;
begin
  if actor is null then return false; end if;
  select * into photo from public.visit_photos where object_path=p_path for share;
  return found and photo.status='pending' and photo.created_by=actor and exists (
    select 1 from public.group_members where group_id=photo.group_id and user_id=actor
  );
end;
$$;
revoke all on function kokoiko_private.can_upload_visit_photo(text) from public,anon,authenticated;
grant usage on schema kokoiko_private to authenticated;
grant execute on function kokoiko_private.can_upload_visit_photo(text) to authenticated;
create policy visit_photos_upload on storage.objects for insert to authenticated with check (
  bucket_id='visit-photos' and kokoiko_private.can_upload_visit_photo(name)
);
create policy visit_photos_download on storage.objects for select to authenticated using (
  bucket_id='visit-photos' and exists(select 1 from public.visit_photos p where p.object_path=storage.objects.name)
);
create policy visit_photos_cancel_upload on storage.objects for delete to authenticated using (
  bucket_id='visit-photos' and exists(select 1 from public.visit_photos p where p.object_path=storage.objects.name and p.status='cancelling')
);

create function public.finish_visit_photo(p_group_id uuid,p_visit_id uuid,p_photo_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); photo public.visit_photos%rowtype; stored jsonb;
begin
  if actor is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then raise exception 'membership required' using errcode='42501'; end if;
  perform 1 from public.visits where id=p_visit_id and group_id=p_group_id for update;
  select * into photo from public.visit_photos where id=p_photo_id and visit_id=p_visit_id and group_id=p_group_id for update;
  if not found or photo.created_by is distinct from actor then raise exception 'photo unavailable' using errcode='42501'; end if;
  if photo.status='ready' then return; end if;
  if photo.status<>'pending' then raise exception 'photo unavailable' using errcode='42501'; end if;
  select metadata into stored from storage.objects where bucket_id='visit-photos' and name=photo.object_path;
  if not found or (stored->>'size')::bigint is distinct from photo.byte_size::bigint or stored->>'mimetype' is distinct from photo.content_type then
    raise exception 'photo upload incomplete' using errcode='22023'; end if;
  update public.visit_photos set status='ready' where id=p_photo_id;
end;
$$;

create function public.begin_cancel_visit_photo(p_group_id uuid,p_visit_id uuid,p_photo_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); photo public.visit_photos%rowtype;
begin
  if actor is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then raise exception 'membership required' using errcode='42501'; end if;
  perform 1 from public.visits where id=p_visit_id and group_id=p_group_id for update;
  select * into photo from public.visit_photos where id=p_photo_id and visit_id=p_visit_id and group_id=p_group_id for update;
  if not found or photo.created_by is distinct from actor or photo.status='ready' then raise exception 'photo unavailable' using errcode='42501'; end if;
  update public.visit_photos set status='cancelling' where id=p_photo_id;
  return photo.object_path;
end;
$$;
create function public.cancel_visit_photo(p_group_id uuid,p_visit_id uuid,p_photo_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); photo public.visit_photos%rowtype;
begin
  if actor is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=actor) then raise exception 'membership required' using errcode='42501'; end if;
  perform 1 from public.visits where id=p_visit_id and group_id=p_group_id for update;
  select * into photo from public.visit_photos where id=p_photo_id and visit_id=p_visit_id and group_id=p_group_id for update;
  if not found then return; end if;
  if photo.created_by is distinct from actor or photo.status<>'cancelling' then raise exception 'photo unavailable' using errcode='42501'; end if;
  if exists(select 1 from storage.objects where bucket_id='visit-photos' and name=photo.object_path) then raise exception 'photo removal incomplete' using errcode='22023'; end if;
  delete from public.visit_photos where id=p_photo_id;
end;
$$;
revoke all on function public.reserve_visit_photo(uuid,uuid,uuid,text,integer), public.finish_visit_photo(uuid,uuid,uuid), public.begin_cancel_visit_photo(uuid,uuid,uuid), public.cancel_visit_photo(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_visit_photo(uuid,uuid,uuid,text,integer), public.finish_visit_photo(uuid,uuid,uuid), public.begin_cancel_visit_photo(uuid,uuid,uuid), public.cancel_visit_photo(uuid,uuid,uuid) to authenticated;
commit;
