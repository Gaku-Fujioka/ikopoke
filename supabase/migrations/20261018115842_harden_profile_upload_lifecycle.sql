-- Recheck account lifecycle after waiting for an in-flight removal.
begin;
create or replace function kokoiko_private.social_media_access(p_path text,p_op text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.profile_media%rowtype; member boolean; current_picture boolean;
begin
 if actor is null or not kokoiko_private.account_active(actor) then return false; end if;
 select * into m from public.profile_media where object_path=p_path;
 if not found then return false; end if;
 if p_op in ('insert','delete') then
  perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
  -- A removal may have committed while this upload waited for the actor lock.
  if not kokoiko_private.account_active(actor) then return false; end if;
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
commit;
