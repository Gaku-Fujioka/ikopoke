-- SOCIAL-01. Pictures share the existing private bucket and deletion pipeline.
begin;
alter table public.groups add column description text not null default '' check(char_length(description)<=500),
 add column cover_media_id uuid, add column presentation_revision integer not null default 1;
alter table public.profiles add column avatar_media_id uuid;
create table public.profile_media(
 id uuid primary key, owner_id uuid not null references auth.users(id),
 group_id uuid references public.groups(id) on delete cascade,
 kind text not null check(kind in ('avatar','cover')),
 object_path text not null unique, byte_size integer not null check(byte_size between 1 and 2097152),
 expected_media_id uuid, status text not null default 'pending' check(status in ('pending','ready','cancelling')),
 created_at timestamptz not null default now(),
 check((kind='avatar')=(group_id is null))
);
create index profile_media_owner_idx on public.profile_media(owner_id);
create index profile_media_group_idx on public.profile_media(group_id);
alter table public.profile_media enable row level security;
revoke all on public.profile_media from public,anon,authenticated;
alter table public.groups add constraint groups_cover_media_fk foreign key(cover_media_id) references public.profile_media(id) deferrable initially deferred;
alter table public.profiles add constraint profiles_avatar_media_fk foreign key(avatar_media_id) references public.profile_media(id) deferrable initially deferred;
create index groups_cover_media_idx on public.groups(cover_media_id) where cover_media_id is not null;
create index profiles_avatar_media_idx on public.profiles(avatar_media_id) where avatar_media_id is not null;
create table public.group_display_preferences(
 group_id uuid not null,user_id uuid not null,color text not null check(color in ('apricot','lemon','mint','sky','aqua','rose','lilac','sand')),
 primary key(group_id,user_id),foreign key(group_id,user_id) references public.group_members(group_id,user_id) on delete cascade
);
create index group_display_preferences_user_idx on public.group_display_preferences(user_id);
alter table public.group_display_preferences enable row level security;
revoke all on public.group_display_preferences from public,anon,authenticated;
grant select on public.group_display_preferences to authenticated;
create policy group_color_read_own on public.group_display_preferences for select to authenticated using(user_id=(select auth.uid()));
create function kokoiko_private.assign_group_color(p_user uuid,p_group uuid) returns void language plpgsql security definer set search_path='' as $$
declare chosen text;
begin
 select c into chosen from unnest(array['apricot','lemon','mint','sky','aqua','rose','lilac','sand']) with ordinality palette(c,n)
 order by (select count(*) from public.group_display_preferences p where p.user_id=p_user and p.color=c),n limit 1;
 insert into public.group_display_preferences values(p_group,p_user,chosen) on conflict do nothing;
end; $$;
create function kokoiko_private.init_group_color() returns trigger language plpgsql security definer set search_path='' as $$begin perform kokoiko_private.assign_group_color(new.user_id,new.group_id);return new;end;$$;
create trigger init_group_color after insert on public.group_members for each row execute function kokoiko_private.init_group_color();
do $$declare m record;begin for m in select user_id,group_id from public.group_members order by user_id,joined_at,group_id loop perform kokoiko_private.assign_group_color(m.user_id,m.group_id);end loop;end;$$;
revoke all on function kokoiko_private.assign_group_color(uuid,uuid),kokoiko_private.init_group_color() from public,anon,authenticated;
create table kokoiko_private.invite_profile_readers(
 user_id uuid not null references auth.users(id),invite_id uuid not null references public.group_invites(id) on delete cascade,
 primary key(user_id,invite_id)
);
create index invite_profile_readers_invite_idx on kokoiko_private.invite_profile_readers(invite_id);
alter table kokoiko_private.invite_profile_readers enable row level security;
revoke all on kokoiko_private.invite_profile_readers from public,anon,authenticated;

create function kokoiko_private.social_member(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and kokoiko_private.account_active(auth.uid()) and exists(
 select 1 from public.group_members m join public.groups g on g.id=m.group_id where m.group_id=p_group and m.user_id=auth.uid() and not g.deleting)
$$;
create function kokoiko_private.social_media_access(p_path text,p_op text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.profile_media%rowtype; member boolean; current_picture boolean;
begin
 if actor is null or not kokoiko_private.account_active(actor) then return false; end if;
 select * into m from public.profile_media where object_path=p_path;
 if not found then return false; end if;
 if p_op in ('insert','delete') then
  perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
  if m.group_id is not null then perform 1 from public.groups where id=m.group_id for share; end if;
  select * into m from public.profile_media where object_path=p_path for share;
  if not found then return false; end if;
 end if;
 member:=m.kind='cover' and exists(select 1 from public.group_members where group_id=m.group_id and user_id=actor);
 current_picture:=exists(select 1 from public.groups where cover_media_id=m.id) or exists(select 1 from public.profiles where avatar_media_id=m.id);
 if p_op='insert' then
  return m.owner_id=actor and m.status='pending' and (m.kind='avatar' or kokoiko_private.social_member(m.group_id));
 elsif p_op='delete' then
  return (m.kind='avatar' and m.owner_id=actor and not current_picture) or
   (member and (exists(select 1 from public.groups where id=m.group_id and deleting) or
    (not current_picture and (m.status='ready' or m.owner_id=actor or not exists(select 1 from public.group_members where group_id=m.group_id and user_id=m.owner_id)))));
 elsif p_op='read' then
  if m.kind='avatar' then
   return (m.owner_id=actor) or (m.status='ready' and current_picture and kokoiko_private.account_active(m.owner_id) and exists(
    select 1 from public.group_members a join public.group_members b on b.group_id=a.group_id
    where a.user_id=actor and b.user_id=m.owner_id));
  end if;
  return (kokoiko_private.social_member(m.group_id) and (m.status='ready' or m.owner_id=actor)) or
   (m.status='ready' and exists(select 1 from public.groups where id=m.group_id and cover_media_id=m.id and not deleting) and exists(
    select 1 from kokoiko_private.invite_profile_readers r join public.group_invites i on i.id=r.invite_id
    where r.user_id=actor and i.group_id=m.group_id and i.revoked_at is null and i.expires_at>now()));
 end if;
 return false;
end; $$;
revoke all on function kokoiko_private.social_member(uuid),kokoiko_private.social_media_access(text,text) from public,anon,authenticated;
grant execute on function kokoiko_private.social_media_access(text,text) to authenticated;
create policy profile_media_storage_insert on storage.objects for insert to authenticated with check(bucket_id='visit-photos' and kokoiko_private.social_media_access(name,'insert'));
create policy profile_media_storage_read on storage.objects for select to authenticated using(bucket_id='visit-photos' and (kokoiko_private.social_media_access(name,'read') or kokoiko_private.social_media_access(name,'delete')));
create policy profile_media_storage_delete on storage.objects for delete to authenticated using(bucket_id='visit-photos' and kokoiko_private.social_media_access(name,'delete'));

create function kokoiko_private.get_group_presentations(p_ids uuid[]) returns table(group_id uuid,description text,cover_id uuid,cover_path text,revision integer,color text)
language sql stable security definer set search_path='' as $$
 select g.id,g.description,g.cover_media_id,m.object_path,g.presentation_revision,c.color
 from public.groups g join public.group_members own on own.group_id=g.id and own.user_id=auth.uid()
 left join public.profile_media m on m.id=g.cover_media_id and m.status='ready'
 left join public.group_display_preferences c on c.group_id=g.id and c.user_id=auth.uid()
 where g.id=any(p_ids) and cardinality(p_ids)<=1000 and kokoiko_private.account_active(auth.uid())
$$;
create function public.get_group_presentations(p_ids uuid[]) returns table(group_id uuid,description text,cover_id uuid,cover_path text,revision integer,color text)
language sql stable security invoker set search_path='' as $$select * from kokoiko_private.get_group_presentations(p_ids)$$;

create function kokoiko_private.save_group_presentation(p_group uuid,p_description text,p_expected integer,p_color text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform kokoiko_private.lock_place_group(p_group);
 if p_color is not null then
  if p_color not in ('apricot','lemon','mint','sky','aqua','rose','lilac','sand') then raise exception 'invalid color' using errcode='22023'; end if;
  insert into public.group_display_preferences values(p_group,auth.uid(),p_color) on conflict(group_id,user_id) do update set color=excluded.color;
 end if;
 if p_description is not null then
  if char_length(p_description)>500 then raise exception 'description too long' using errcode='22023'; end if;
  update public.groups set description=btrim(p_description),presentation_revision=presentation_revision+1 where id=p_group and presentation_revision=p_expected;
  if not found then raise exception 'profile changed' using errcode='40001'; end if;
 end if;
end; $$;
create function public.save_group_presentation(p_group uuid,p_description text,p_expected integer,p_color text) returns void
language sql security invoker set search_path='' as $$select kokoiko_private.save_group_presentation(p_group,p_description,p_expected,p_color)$$;

create function kokoiko_private.edit_profile_media(p_action text,p_kind text,p_group uuid,p_id uuid,p_expected uuid,p_size integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.profile_media%rowtype; current_id uuid; path text;
begin
 if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
 if not kokoiko_private.account_active(actor) then raise exception 'account unavailable' using errcode='55000'; end if;
 if p_kind='cover' and p_group is not null then
  perform kokoiko_private.lock_place_group(p_group);
  select cover_media_id into current_id from public.groups where id=p_group for update;
 elsif p_kind='avatar' and p_group is null then
  select avatar_media_id into current_id from public.profiles where user_id=actor for update;
  if not found then raise exception 'set display name first' using errcode='55000'; end if;
 else raise exception 'invalid kind' using errcode='22023'; end if;
 if p_action='detach' then
  if current_id is distinct from p_expected then raise exception 'picture changed' using errcode='40001'; end if;
  if p_kind='cover' then update public.groups set cover_media_id=null,presentation_revision=presentation_revision+1 where id=p_group;
  else update public.profiles set avatar_media_id=null where user_id=actor; end if;
  return jsonb_build_object('id',current_id);
 end if;
 if p_id is null then raise exception 'invalid picture' using errcode='22023'; end if;
 select * into m from public.profile_media where id=p_id for update;
 if p_action='reserve' then
  if p_size is null or p_size not between 1 and 2097152 then raise exception 'invalid picture size' using errcode='22023'; end if;
  if found then
   if m.owner_id<>actor or m.kind<>p_kind or m.group_id is distinct from p_group or m.byte_size<>p_size or m.expected_media_id is distinct from p_expected then raise exception 'request reused' using errcode='23505'; end if;
  else
   if current_id is distinct from p_expected then raise exception 'picture changed' using errcode='40001'; end if;
   if (select count(*) from public.profile_media where owner_id=actor and status='pending')>=4 then raise exception 'finish pending pictures' using errcode='54000'; end if;
   -- Non-UUID namespace cannot collide with an existing visit's UUID prefix.
   path:=case when p_kind='avatar' then 'profile-avatar/' else 'profile-cover/' end||coalesce(p_group,actor)::text||'/'||p_id::text||'.jpg';
   insert into public.profile_media(id,owner_id,group_id,kind,object_path,byte_size,expected_media_id) values(p_id,actor,p_group,p_kind,path,p_size,p_expected) returning * into m;
  end if;
  return jsonb_build_object('id',m.id,'path',m.object_path,'status',m.status);
 end if;
 if not found and p_action in ('discard','forget') then return '{}'::jsonb; end if;
 if not found or m.kind<>p_kind or m.group_id is distinct from p_group or (p_kind='avatar' and m.owner_id<>actor) then raise exception 'picture unavailable' using errcode='42501'; end if;
 if p_action='publish' then
  if m.owner_id<>actor then raise exception 'picture unavailable' using errcode='42501'; end if;
  if current_id=m.id and m.status='ready' then return jsonb_build_object('id',m.id,'path',m.object_path); end if;
  if m.status<>'pending' then raise exception 'picture unavailable' using errcode='55000'; end if;
  if current_id is distinct from m.expected_media_id then raise exception 'picture changed' using errcode='40001'; end if;
  if not exists(select 1 from storage.objects where bucket_id='visit-photos' and name=m.object_path and metadata->>'mimetype'='image/jpeg' and (metadata->>'size')::bigint=m.byte_size) then raise exception 'upload incomplete' using errcode='55000'; end if;
  update public.profile_media set status='ready' where id=m.id;
  if p_kind='cover' then update public.groups set cover_media_id=m.id,presentation_revision=presentation_revision+1 where id=p_group;
  else update public.profiles set avatar_media_id=m.id where user_id=actor; end if;
  return jsonb_build_object('id',m.id,'path',m.object_path);
 elsif p_action='discard' then
  if current_id=m.id or (m.status='pending' and m.owner_id<>actor and exists(select 1 from public.group_members where group_id=p_group and user_id=m.owner_id)) then raise exception 'picture in use' using errcode='42501'; end if;
  update public.profile_media set status='cancelling' where id=m.id;
  return jsonb_build_object('id',m.id,'path',m.object_path);
 elsif p_action='forget' then
  if current_id=m.id or m.status<>'cancelling' or exists(select 1 from storage.objects where bucket_id='visit-photos' and name=m.object_path) then raise exception 'removal incomplete' using errcode='55000'; end if;
  delete from public.profile_media where id=m.id;
  return '{}'::jsonb;
 end if;
 raise exception 'invalid operation' using errcode='22023';
end; $$;
create function public.edit_profile_media(p_action text,p_kind text,p_group uuid,p_id uuid,p_expected uuid,p_size integer) returns jsonb
language sql security invoker set search_path='' as $$select kokoiko_private.edit_profile_media(p_action,p_kind,p_group,p_id,p_expected,p_size)$$;

create function kokoiko_private.get_profile_editor(p_group uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();current_id uuid;path text; pending jsonb;
begin
 if actor is null or not kokoiko_private.account_active(actor) then raise exception 'account unavailable' using errcode='42501'; end if;
 if p_group is not null then
  if not kokoiko_private.social_member(p_group) then raise exception 'group unavailable' using errcode='42501'; end if;
  select cover_media_id into current_id from public.groups where id=p_group;
 else select avatar_media_id into current_id from public.profiles where user_id=actor; end if;
 select object_path into path from public.profile_media where id=current_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'status',m.status,'can_publish',m.owner_id=actor and m.status='pending') order by m.created_at),'[]'::jsonb) into pending from public.profile_media m
 where m.id is distinct from current_id and ((p_group is null and m.kind='avatar' and m.owner_id=actor) or (p_group is not null and m.group_id=p_group and (m.status='ready' or m.owner_id=actor or not exists(select 1 from public.group_members where group_id=p_group and user_id=m.owner_id))));
 return jsonb_build_object('id',current_id,'path',path,'unused',pending);
end; $$;
create function public.get_profile_editor(p_group uuid) returns jsonb language sql stable security invoker set search_path='' as $$select kokoiko_private.get_profile_editor(p_group)$$;

create function kokoiko_private.preview_group_profile(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.group_invites%rowtype; result jsonb;
begin
 if auth.uid() is null or not kokoiko_private.account_active(auth.uid()) then raise exception 'authentication required' using errcode='28000'; end if;
 -- Reuse token validation, expiry and lifecycle checks before revealing anything.
 perform public.preview_group_invite(p_token);
 select * into invitation from public.group_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'invite unavailable' using errcode='P0001'; end if;
 insert into kokoiko_private.invite_profile_readers values(auth.uid(),invitation.id) on conflict do nothing;
 select jsonb_build_object('group_id',g.id,'group_name',g.name,'expires_at',invitation.expires_at,'description',g.description,'cover_path',m.object_path) into result
 from public.groups g left join public.profile_media m on m.id=g.cover_media_id and m.status='ready' where g.id=invitation.group_id and not g.deleting;
 if result is null then raise exception 'invite unavailable' using errcode='P0001'; end if;
 return result;
end; $$;
create function public.preview_group_profile(p_token text) returns jsonb language sql security invoker set search_path='' as $$select kokoiko_private.preview_group_profile(p_token)$$;

-- Avatar lookups return no email or IDs that were not supplied by the caller.
create function kokoiko_private.get_member_avatars(p_group uuid) returns table(user_id uuid,path text) language sql stable security definer set search_path='' as $$
 select m.user_id,a.object_path from public.group_members m join public.profiles p on p.user_id=m.user_id
 join public.profile_media a on a.id=p.avatar_media_id and a.status='ready'
 where m.group_id=p_group and kokoiko_private.social_member(p_group) and kokoiko_private.account_active(m.user_id)
$$;
create function public.get_member_avatars(p_group uuid) returns table(user_id uuid,path text) language sql stable security invoker set search_path='' as $$select * from kokoiko_private.get_member_avatars(p_group)$$;
create function kokoiko_private.get_social_avatars(p_group uuid,p_keys text[],p_comments boolean) returns table(key text,path text)
language sql stable security definer set search_path='' as $$
 with authors as (
  select case when p_comments then c.id::text else md5('comment:'||c.id::text) end k,c.created_by who from public.item_comments c join public.items i on i.id=c.item_id where i.group_id=p_group
  union all select md5('item:'||i.id::text),i.created_by from public.items i where i.group_id=p_group and not p_comments
  union all select md5('reaction:'||r.item_id::text||':'||r.user_id::text),r.user_id from public.item_reactions r join public.items i on i.id=r.item_id where i.group_id=p_group and not p_comments
  union all select md5('outing:'||o.id::text),o.created_by from public.outings o where o.group_id=p_group and not p_comments
  union all select md5('visit:'||v.id::text),v.created_by from public.visits v where v.group_id=p_group and not p_comments
 ) select a.k,media.object_path from authors a join public.group_members member on member.group_id=p_group and member.user_id=a.who
 join public.profiles p on p.user_id=member.user_id join public.profile_media media on media.id=p.avatar_media_id and media.status='ready'
 where a.k=any(p_keys) and cardinality(p_keys)<=100 and kokoiko_private.social_member(p_group) and kokoiko_private.account_active(a.who)
$$;
create function public.get_social_avatars(p_group uuid,p_keys text[],p_comments boolean) returns table(key text,path text)
language sql stable security invoker set search_path='' as $$select * from kokoiko_private.get_social_avatars(p_group,p_keys,p_comments)$$;

-- Last-member/account removal must remove profile bytes through Storage first.
create function kokoiko_private.guard_social_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='groups' then
  if exists(select 1 from public.profile_media m join storage.objects o on o.bucket_id='visit-photos' and o.name=m.object_path where m.group_id=old.id) then raise exception 'profile removal incomplete' using errcode='55000'; end if;
  return old;
 elsif tg_table_name='profiles' then
  if not kokoiko_private.account_active(new.user_id) then new.avatar_media_id:=null; end if;
  return new;
 else
  if new.state='data_removed' and old.state='pending' then
   if exists(select 1 from public.profile_media m join storage.objects o on o.bucket_id='visit-photos' and o.name=m.object_path where m.kind='avatar' and m.owner_id=new.user_id) then raise exception 'avatar removal incomplete' using errcode='55000'; end if;
   delete from public.profile_media where kind='avatar' and owner_id=new.user_id;
  end if;
  return new;
 end if;
end; $$;
create trigger guard_social_group_cleanup before delete on public.groups for each row execute function kokoiko_private.guard_social_cleanup();
create trigger guard_social_profile_cleanup before update on public.profiles for each row execute function kokoiko_private.guard_social_cleanup();
create trigger guard_social_account_cleanup before update on kokoiko_private.account_deletions for each row execute function kokoiko_private.guard_social_cleanup();
create or replace function public.get_group_cleanup_paths(p_group_id uuid) returns table(object_path text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.groups g join public.group_members m on m.group_id=g.id where g.id=p_group_id and g.deleting and m.user_id=auth.uid()) or (select count(*) from public.group_members where group_id=p_group_id)<>1 then raise exception 'group unavailable' using errcode='42501'; end if;
 return query select o.name from storage.objects o where o.bucket_id='visit-photos' and (exists(select 1 from public.visit_photos p where p.group_id=p_group_id and p.object_path=o.name) or exists(select 1 from public.profile_media m where m.group_id=p_group_id and m.object_path=o.name)) order by o.name limit 1000;
end; $$;
create or replace function public.get_account_cleanup_paths(p_user_id uuid,p_request_id uuid) returns table(object_path text) language plpgsql stable security definer set search_path='' as $$
declare job kokoiko_private.account_deletions%rowtype;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'server only' using errcode='42501'; end if;
 select * into job from kokoiko_private.account_deletions where user_id=p_user_id and request_id=p_request_id;
 if not found then raise exception 'removal unavailable' using errcode='42501'; end if;
 return query select o.name from storage.objects o where o.bucket_id='visit-photos' and (exists(select 1 from public.visit_photos p where p.group_id=any(job.delete_group_ids) and p.object_path=o.name) or exists(select 1 from public.profile_media m where m.object_path=o.name and ((m.kind='avatar' and m.owner_id=p_user_id) or m.group_id=any(job.delete_group_ids)))) order by o.name limit 1000;
end; $$;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','kokoiko_private') and p.proname in ('get_group_presentations','save_group_presentation','edit_profile_media','get_profile_editor','preview_group_profile','get_member_avatars','get_social_avatars') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
revoke all on function kokoiko_private.guard_social_cleanup() from public,anon,authenticated;
commit;
