begin;

alter table public.memories add constraint memories_id_group_key unique(id,group_id);
create table public.memory_pages(
 id uuid primary key,
 memory_id uuid not null,
 group_id uuid not null,
 visit_id uuid unique,
 after_visit_id uuid,
 position integer not null default 0 check(position>=0),
 title text not null default '' check(char_length(title)<=120),
 body text not null default '' check(char_length(body)<=2000),
 revision integer not null default 0 check(revision>=0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 deleting boolean not null default false,
 deleted boolean not null default false,
 unique(id,group_id),
 unique(id,memory_id,group_id),
 foreign key(memory_id,group_id) references public.memories(id,group_id) on delete cascade,
 foreign key(visit_id,group_id) references public.visits(id,group_id) on delete cascade,
 foreign key(after_visit_id,group_id) references public.visits(id,group_id) on delete set null (after_visit_id),
 check((visit_id is not null and id=visit_id and after_visit_id is null) or (visit_id is null and char_length(title)>0 and title ~ '[^[:space:]]'))
);
create index memory_pages_memory_idx on public.memory_pages(memory_id,after_visit_id,position,id);
create index memory_pages_after_visit_idx on public.memory_pages(after_visit_id,group_id) where after_visit_id is not null;
create index memory_pages_author_idx on public.memory_pages(created_by);
create table public.memory_words(
 id uuid primary key,
 memory_id uuid not null,
 group_id uuid not null,
 page_id uuid,
 body text not null check(char_length(body)<=500),
 revision integer not null default 1 check(revision>0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 deleted boolean not null default false,
 foreign key(memory_id,group_id) references public.memories(id,group_id) on delete cascade,
 foreign key(page_id,memory_id,group_id) references public.memory_pages(id,memory_id,group_id) on delete cascade
);
create index memory_words_book_idx on public.memory_words(memory_id,created_at,id);
create index memory_words_page_idx on public.memory_words(page_id,memory_id,group_id);
create index memory_words_author_idx on public.memory_words(created_by);
alter table public.memory_pages enable row level security;
alter table public.memory_words enable row level security;
revoke all on public.memory_pages,public.memory_words from public,anon,authenticated;
grant select(id,memory_id,group_id,visit_id,after_visit_id,position,title,body,revision,created_at,deleting,deleted) on public.memory_pages to authenticated;
grant select(id,memory_id,group_id,page_id,body,revision,created_at,deleted) on public.memory_words to authenticated;
create policy memory_pages_member on public.memory_pages for select to authenticated using(not deleted and exists(select 1 from public.group_members m where m.group_id=memory_pages.group_id and m.user_id=(select auth.uid())));
create policy memory_words_member on public.memory_words for select to authenticated using(not deleted and exists(select 1 from public.group_members m where m.group_id=memory_words.group_id and m.user_id=(select auth.uid())));
create trigger lifecycle_write_guard before insert or update or delete on public.memory_pages for each row execute function kokoiko_private.guard_group_write();
create trigger lifecycle_write_guard before insert or update or delete on public.memory_words for each row execute function kokoiko_private.guard_group_write();

-- Reuse the existing private photo bucket, upload reservations and group/account
-- cleanup. A photo belongs to exactly one visit OR one free book page.
alter table public.visit_photos alter column visit_id drop not null;
alter table public.visit_photos add column memory_page_id uuid,
 add constraint visit_photos_parent_check check((visit_id is null)<>(memory_page_id is null)),
 add constraint visit_photos_memory_page_fk foreign key(memory_page_id,group_id) references public.memory_pages(id,group_id) on delete cascade,
 add constraint visit_photos_memory_page_slot_key unique(memory_page_id,slot);
create index visit_photos_memory_page_group_idx on public.visit_photos(memory_page_id,group_id) where memory_page_id is not null;
grant select(memory_page_id) on public.visit_photos to authenticated;

create function kokoiko_private.lock_memory_book(p_memory uuid) returns public.memories
language plpgsql security definer set search_path='' as $$
declare m public.memories%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,702101));
 if not kokoiko_private.account_active(auth.uid()) then raise exception 'account unavailable' using errcode='55000'; end if;
 select * into m from public.memories where id=p_memory;
 if not found then raise exception 'book unavailable' using errcode='42501'; end if;
 perform 1 from public.groups where id=m.group_id and not deleting for share;
 if not found then raise exception 'group unavailable' using errcode='55000'; end if;
 perform 1 from public.group_members where group_id=m.group_id and user_id=auth.uid() for share;
 if not found then raise exception 'membership required' using errcode='42501'; end if;
 select * into m from public.memories where id=p_memory for update;
 return m;
end; $$;

-- Visit page IDs equal their visit IDs. Metadata is created only when needed;
-- untouched books continue using the existing chronological visit ordering.
create function kokoiko_private.resolve_memory_page(p_memory uuid,p_page uuid) returns public.memory_pages
language plpgsql security definer set search_path='' as $$
declare m public.memories%rowtype; p public.memory_pages%rowtype;
begin
 select * into m from public.memories where id=p_memory;
 select * into p from public.memory_pages where id=p_page and memory_id=p_memory;
 if not found then
  if not exists(select 1 from public.visits where id=p_page and group_id=m.group_id and outing_id=m.outing_id and not deleting) then raise exception 'page unavailable' using errcode='42501'; end if;
  insert into public.memory_pages(id,memory_id,group_id,visit_id,created_by) values(p_page,p_memory,m.group_id,p_page,auth.uid()) returning * into p;
 end if;
 if p.deleted or p.deleting or (p.visit_id is not null and not exists(select 1 from public.visits where id=p.visit_id and outing_id=m.outing_id and not deleting)) then raise exception 'page unavailable' using errcode='55000'; end if;
 return p;
end; $$;

create function kokoiko_private.open_memory_book(p_group uuid,p_outing uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.outings%rowtype; result uuid;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,702101));
 if not kokoiko_private.account_active(auth.uid()) then raise exception 'account unavailable' using errcode='55000'; end if;
 perform 1 from public.groups where id=p_group and not deleting for share;
 if not found then raise exception 'group unavailable' using errcode='42501'; end if;
 perform 1 from public.group_members where group_id=p_group and user_id=auth.uid() for share;
 if not found then raise exception 'membership required' using errcode='42501'; end if;
 select * into o from public.outings where id=p_outing and group_id=p_group for update;
 if not found then raise exception 'outing unavailable' using errcode='42501'; end if;
 insert into public.memories(group_id,outing_id,title,memory_date,memory_end_date,note) values(p_group,p_outing,o.title,o.outing_date,o.end_date,o.memo) on conflict(outing_id) do nothing;
 select id into result from public.memories where outing_id=p_outing;
 return result;
end; $$;
create function public.open_memory_book(p_group uuid,p_outing uuid) returns uuid
language sql security invoker set search_path='' as $$select kokoiko_private.open_memory_book(p_group,p_outing)$$;

create function kokoiko_private.mutate_memory_book(p_memory uuid,p_operation text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.memories%rowtype; p public.memory_pages%rowtype; anchor public.memory_pages%rowtype; w public.memory_words%rowtype; photo public.visit_photos%rowtype;
 actor uuid:=auth.uid(); target uuid; page_id uuid; expected integer; label text; content text; after_visit uuid; place integer; free_slot integer; mime text; bytes integer; path text; stored jsonb;
begin
 m:=kokoiko_private.lock_memory_book(p_memory);
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'invalid data' using errcode='22023'; end if;
 target:=(p_data->>'id')::uuid; page_id:=(p_data->>'page_id')::uuid; expected:=(p_data->>'revision')::integer;
 if p_operation in ('add_page','edit_page') then
  label:=btrim(p_data->>'title',E' \t\n\r'||chr(12288)||chr(160)); content:=p_data->>'body';
  if target is null or label is null or char_length(label)>120 or content is null or char_length(content)>2000 then raise exception 'invalid page' using errcode='22023'; end if;
  if p_operation='add_page' then
   if label='' or exists(select 1 from public.visits where id=target) then raise exception 'invalid page' using errcode='22023'; end if;
   if page_id is null then after_visit:=null;place:=0;
   else anchor:=kokoiko_private.resolve_memory_page(p_memory,page_id);after_visit:=coalesce(anchor.visit_id,anchor.after_visit_id);place:=case when anchor.visit_id is null then anchor.position else 0 end;
   end if;
   select * into p from public.memory_pages where id=target;
   if found then
    if p.memory_id<>p_memory or p.created_by<>actor or p.deleted or p.deleting or p.title<>label or p.body<>content or p.after_visit_id is distinct from after_visit then raise exception 'request conflict' using errcode='23505'; end if;
    return jsonb_build_object('id',p.id,'revision',p.revision);
   end if;
   if (select count(*) from public.memory_pages where memory_id=p_memory and visit_id is null and not deleted)>=100 then raise exception 'page limit' using errcode='54000'; end if;
   update public.memory_pages set position=position+1 where memory_id=p_memory and visit_id is null and after_visit_id is not distinct from after_visit and position>place and not deleted;
   insert into public.memory_pages(id,memory_id,group_id,after_visit_id,position,title,body,revision,created_by) values(target,p_memory,m.group_id,after_visit,place+1,label,content,1,actor) returning * into p;
  else
   p:=kokoiko_private.resolve_memory_page(p_memory,target);
   if p.visit_id is null and label='' then raise exception 'title required' using errcode='22023'; end if;
   if p.title=label and p.body=content then return jsonb_build_object('id',p.id,'revision',p.revision); end if;
   if expected is null or p.revision<>expected then raise exception 'page changed' using errcode='40001'; end if;
   -- A visit's original note/name remain in visits. Only its book title changes.
   if p.visit_id is not null and content<>'' then raise exception 'visit body is separate' using errcode='22023'; end if;
   update public.memory_pages set title=label,body=content,revision=revision+1 where id=target returning * into p;
  end if;
  return jsonb_build_object('id',p.id,'revision',p.revision);
 elsif p_operation in ('save_word','delete_word') then
  if target is null or expected is null or expected<0 then raise exception 'invalid word' using errcode='22023'; end if;
  if page_id is not null then p:=kokoiko_private.resolve_memory_page(p_memory,page_id); end if;
  content:=btrim(p_data->>'body',E' \t\n\r'||chr(12288)||chr(160));
  select * into w from public.memory_words where id=target;
  if found then
   if w.memory_id<>p_memory or w.created_by<>actor or w.page_id is distinct from page_id then raise exception 'word unavailable' using errcode='42501'; end if;
   if p_operation='delete_word' and w.deleted then return jsonb_build_object('id',target,'revision',w.revision); end if;
   if w.deleted then raise exception 'word removed' using errcode='40001'; end if;
   if p_operation='save_word' and w.body=content then return jsonb_build_object('id',target,'revision',w.revision); end if;
   if w.revision<>expected then raise exception 'word changed' using errcode='40001'; end if;
   if p_operation='delete_word' then
    if (p_data->>'confirm') is distinct from 'true' then raise exception 'confirmation required' using errcode='22023'; end if;
    update public.memory_words set body='',deleted=true,revision=revision+1 where id=target returning * into w;
    return jsonb_build_object('id',target,'revision',w.revision);
   end if;
  elsif expected<>0 or p_operation<>'save_word' then raise exception 'word unavailable' using errcode='40001';
  end if;
  if content is null or char_length(content) not between 1 and 500 then raise exception 'invalid word' using errcode='22023'; end if;
  if w.id is null then
   if (select count(*) from public.memory_words where memory_id=p_memory and not deleted)>=1000 then raise exception 'word limit' using errcode='54000'; end if;
   insert into public.memory_words(id,memory_id,group_id,page_id,body,created_by) values(target,p_memory,m.group_id,page_id,content,actor) returning * into w;
  else update public.memory_words set body=content,revision=revision+1 where id=target returning * into w;
  end if;
  return jsonb_build_object('id',target,'revision',w.revision);
 elsif p_operation in ('reserve_photo','finish_photo','begin_remove_photo','finish_remove_photo','begin_remove_page','finish_remove_page') then
  if page_id is null then raise exception 'page required' using errcode='22023'; end if;
  select * into p from public.memory_pages where id=page_id and memory_id=p_memory and visit_id is null;
  if not found or p.deleted then raise exception 'page unavailable' using errcode='42501'; end if;
  if p_operation in ('begin_remove_page','finish_remove_page') then
   if p.created_by<>actor and exists(select 1 from public.group_members where group_id=m.group_id and user_id=p.created_by) then raise exception 'page unavailable' using errcode='42501'; end if;
   if (p_data->>'confirm') is distinct from 'true' then raise exception 'confirmation required' using errcode='22023'; end if;
   if p_operation='begin_remove_page' then
    if expected is null or p.revision<>expected then raise exception 'page changed' using errcode='40001'; end if;
    update public.memory_pages set deleting=true where id=page_id;
    update public.visit_photos set status='cancelling',deletion_actor=actor where memory_page_id=page_id;
    return jsonb_build_object('paths',coalesce((select jsonb_agg(object_path) from public.visit_photos where memory_page_id=page_id),'[]'::jsonb));
   end if;
   if not p.deleting or exists(select 1 from public.visit_photos f join storage.objects o on o.name=f.object_path and o.bucket_id='visit-photos' where f.memory_page_id=page_id) then raise exception 'photo removal incomplete' using errcode='55000'; end if;
   delete from public.visit_photos where memory_page_id=page_id;
   update public.memory_words word_row set body='',deleted=true,revision=word_row.revision+1 where word_row.page_id=p.id and not word_row.deleted;
   update public.memory_pages set deleted=true,body='',revision=revision+1 where id=page_id;
   return jsonb_build_object('id',page_id,'revision',p.revision+1);
  end if;
  if target is null then raise exception 'photo required' using errcode='22023'; end if;
  select * into photo from public.visit_photos where id=target;
  if found and (photo.memory_page_id is distinct from page_id or photo.group_id<>m.group_id) then raise exception 'photo unavailable' using errcode='42501'; end if;
  if p_operation='reserve_photo' then
   if p.deleting then raise exception 'page unavailable' using errcode='55000'; end if;
   mime:=p_data->>'content_type';bytes:=(p_data->>'byte_size')::integer;
   if mime is null or mime not in ('image/jpeg','image/png','image/webp') or bytes is null or bytes not between 1 and 10485760 then raise exception 'invalid photo' using errcode='22023'; end if;
   if photo.id is not null then
    if photo.created_by<>actor or photo.content_type<>mime or photo.byte_size<>bytes then raise exception 'request conflict' using errcode='23505'; end if;
    return jsonb_build_object('id',target,'object_path',photo.object_path,'status',photo.status);
   end if;
   select s into free_slot from generate_series(1,10) s where not exists(select 1 from public.visit_photos where memory_page_id=page_id and slot=s) order by s limit 1;
   if free_slot is null then raise exception 'photo limit' using errcode='54000'; end if;
   path:=m.group_id::text||'/'||page_id::text||'/'||target::text||case mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
   insert into public.visit_photos(id,group_id,memory_page_id,slot,object_path,content_type,byte_size,created_by) values(target,m.group_id,page_id,free_slot,path,mime,bytes,actor);
   return jsonb_build_object('id',target,'object_path',path,'status','pending');
  end if;
  if photo.id is null then
   if p_operation='finish_remove_photo' then return jsonb_build_object('id',target); end if;
   raise exception 'photo unavailable' using errcode='42501';
  end if;
  if p_operation='finish_photo' then
   if p.deleting or photo.created_by<>actor or photo.status='cancelling' then raise exception 'photo unavailable' using errcode='42501'; end if;
   if photo.status<>'ready' then
    select metadata into stored from storage.objects where bucket_id='visit-photos' and name=photo.object_path;
    if not found or (stored->>'size')::bigint is distinct from photo.byte_size::bigint or stored->>'mimetype' is distinct from photo.content_type then raise exception 'upload incomplete' using errcode='55000'; end if;
    update public.visit_photos set status='ready' where id=target;
   end if;
  else
   if photo.created_by<>actor and photo.deletion_actor is distinct from actor and exists(select 1 from public.group_members where group_id=m.group_id and user_id=photo.created_by) then raise exception 'photo unavailable' using errcode='42501'; end if;
   if p_operation='begin_remove_photo' then
    update public.visit_photos set status='cancelling',deletion_actor=actor where id=target;
    return jsonb_build_object('id',target,'object_path',photo.object_path);
   end if;
   if photo.status<>'cancelling' or exists(select 1 from storage.objects where bucket_id='visit-photos' and name=photo.object_path) then raise exception 'photo removal incomplete' using errcode='55000'; end if;
   delete from public.visit_photos where id=target;
  end if;
  return jsonb_build_object('id',target);
 end if;
 raise exception 'invalid operation' using errcode='22023';
end; $$;
create function public.mutate_memory_book(p_memory uuid,p_operation text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$select kokoiko_private.mutate_memory_book(p_memory,p_operation,p_data)$$;

create function kokoiko_private.get_memory_book(p_memory uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m public.memories%rowtype; result jsonb;
begin
 select * into m from public.memories where id=p_memory;
 if not found or not kokoiko_private.social_member(m.group_id) then raise exception 'book unavailable' using errcode='42501'; end if;
 select jsonb_build_object(
  'pages',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'visit_id',p.visit_id,'after_visit_id',p.after_visit_id,'position',p.position,'title',p.title,'body',p.body,'revision',p.revision,'deleting',p.deleting,'can_delete',p.visit_id is null and (p.created_by=auth.uid() or not exists(select 1 from public.group_members where group_id=m.group_id and user_id=p.created_by))) order by p.position,p.created_at,p.id) from public.memory_pages p where p.memory_id=p_memory and not p.deleted),'[]'::jsonb),
  'words',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'page_id',w.page_id,'body',w.body,'revision',w.revision,'created_at',w.created_at,'is_mine',w.created_by=auth.uid(),'author_name',case when member.user_id is null then '退出したメンバー' else coalesce(nullif(profile.display_name,''),'メンバー') end) order by w.created_at,w.id) from public.memory_words w left join public.group_members member on member.group_id=m.group_id and member.user_id=w.created_by left join public.profiles profile on profile.user_id=member.user_id where w.memory_id=p_memory and not w.deleted),'[]'::jsonb),
  'photos',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'group_id',f.group_id,'visit_id',f.visit_id,'memory_page_id',f.memory_page_id,'slot',f.slot,'display_order',f.display_order,'object_path',f.object_path,'content_type',f.content_type,'byte_size',f.byte_size,'status',f.status,'created_at',f.created_at,'can_delete',f.created_by=auth.uid() or f.deletion_actor=auth.uid() or not exists(select 1 from public.group_members where group_id=m.group_id and user_id=f.created_by)) order by f.display_order,f.id) from public.visit_photos f join public.memory_pages p on p.id=f.memory_page_id where p.memory_id=p_memory and not p.deleted and (f.status='ready' or f.created_by=auth.uid() or f.deletion_actor=auth.uid() or not exists(select 1 from public.group_members where group_id=m.group_id and user_id=f.created_by))),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
create function public.get_memory_book(p_memory uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select kokoiko_private.get_memory_book(p_memory)$$;

revoke all on function kokoiko_private.lock_memory_book(uuid),kokoiko_private.resolve_memory_page(uuid,uuid) from public,anon,authenticated;
revoke all on function kokoiko_private.open_memory_book(uuid,uuid),public.open_memory_book(uuid,uuid),kokoiko_private.mutate_memory_book(uuid,text,jsonb),public.mutate_memory_book(uuid,text,jsonb),kokoiko_private.get_memory_book(uuid),public.get_memory_book(uuid) from public,anon,authenticated;
grant execute on function kokoiko_private.open_memory_book(uuid,uuid),public.open_memory_book(uuid,uuid),kokoiko_private.mutate_memory_book(uuid,text,jsonb),public.mutate_memory_book(uuid,text,jsonb),kokoiko_private.get_memory_book(uuid),public.get_memory_book(uuid) to authenticated;

create or replace function kokoiko_private.guard_visit_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='visits' then
    if old.deleting and new is distinct from old then raise exception 'visit removal in progress' using errcode='55000'; end if;
  elsif tg_table_name='visit_photos' and to_jsonb(new)->>'memory_page_id' is not null then
    perform 1 from public.memory_pages where id=new.memory_page_id and not deleting and not deleted for update;
    if not found and new.status<>'cancelling' then raise exception 'page removal in progress' using errcode='55000'; end if;
    if tg_op='INSERT' or (old.status='pending' and new.status='ready') then
      select coalesce(max(display_order),0)+1 into new.display_order from public.visit_photos where memory_page_id=new.memory_page_id and id<>new.id;
    end if;
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
 return found and photo.status='pending' and photo.created_by=actor and (exists(select 1 from public.visits where id=photo.visit_id and not deleting) or exists(select 1 from public.memory_pages where id=photo.memory_page_id and not deleting and not deleted)) and exists(select 1 from public.group_members where group_id=photo.group_id and user_id=actor);
end; $$;

create or replace function public.set_memory_cover(p_group_id uuid,p_memory_id uuid,p_photo_id uuid,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare memory public.memories%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'membership required' using errcode='42501'; end if;
  select * into memory from public.memories where id=p_memory_id and group_id=p_group_id for update;
  if not found then raise exception 'album unavailable' using errcode='42501'; end if;
  if memory.cover_photo_id is not distinct from p_photo_id then return memory.revision; end if;
  if memory.revision is distinct from p_expected_revision then raise exception 'album changed' using errcode='40001'; end if;
  if p_photo_id is not null then
    perform 1 from public.visit_photos p left join public.visits v on v.id=p.visit_id left join public.memory_pages book on book.id=p.memory_page_id where p.id=p_photo_id and p.group_id=p_group_id and p.status='ready' and ((not v.deleting and v.outing_id=memory.outing_id) or (book.memory_id=memory.id and not book.deleting and not book.deleted)) for share of p;
    if not found then raise exception 'photo unavailable' using errcode='42501'; end if;
  end if;
  update public.memories set cover_photo_id=p_photo_id,revision=revision+1 where id=p_memory_id returning revision into memory.revision;
  return memory.revision;
end; $$;
commit;
