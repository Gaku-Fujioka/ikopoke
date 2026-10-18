begin;
-- Persist only the provider identifier; coordinates/names/photos/reviews are
-- fetched into the mounted Google map, never cached in application tables.
create table public.item_places (
 item_id uuid primary key,
 group_id uuid not null references public.groups(id) on delete cascade,
 place_id text not null check(char_length(place_id) between 1 and 255 and place_id ~ '^[A-Za-z0-9_-]+$'),
 foreign key(item_id,group_id) references public.items(id,group_id) on delete cascade,
 unique(group_id,place_id)
);
alter table public.item_places enable row level security;
revoke all on public.item_places from public,anon,authenticated,service_role;
grant select on public.item_places to authenticated;
create policy item_places_read_member on public.item_places for select to authenticated
 using(exists(select 1 from public.group_members m where m.group_id=item_places.group_id and m.user_id=(select auth.uid())));
create trigger lifecycle_write_guard before insert or update or delete on public.item_places
 for each row execute function kokoiko_private.guard_group_write();

create function kokoiko_private.lock_place_group(p_group_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
 if not kokoiko_private.account_active(actor) then raise exception 'account unavailable' using errcode='55000'; end if;
 perform 1 from public.groups where id=p_group_id and not deleting for share;
 if not found then raise exception 'group unavailable' using errcode='42501'; end if;
 perform 1 from public.group_members where group_id=p_group_id and user_id=actor for share;
 if not found then raise exception 'membership required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_group_id::text,702102));
end; $$;
revoke all on function kokoiko_private.lock_place_group(uuid) from public,anon,authenticated,service_role;

create function kokoiko_private.save_place_item(p_group_id uuid,p_place_id text,p_title text,p_list_ids uuid[],p_request_id uuid)
returns table(item_id uuid,reused boolean,archived boolean)
language plpgsql security definer set search_path='' as $$
declare target uuid; list_id uuid; was_saved boolean:=false; prior public.items%rowtype;
begin
 perform kokoiko_private.lock_place_group(p_group_id);
 if p_place_id is null or char_length(p_place_id) not between 1 and 255 or p_place_id !~ '^[A-Za-z0-9_-]+$' or
    p_request_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 100 or
    p_title !~ '[^[:space:]]' or p_list_ids is null or cardinality(p_list_ids)>20 or array_position(p_list_ids,null) is not null then
  raise exception 'invalid place input' using errcode='22023';
 end if;
 select * into prior from public.items where id=p_request_id;
 if found and (prior.created_by is distinct from auth.uid() or prior.group_id is distinct from p_group_id or
   not exists(select 1 from public.item_places p where p.item_id=prior.id and p.place_id=p_place_id)) then
  raise exception 'request conflict' using errcode='23505';
 end if;
 select p.item_id into target from public.item_places p where p.group_id=p_group_id and p.place_id=p_place_id;
 if target is null then
  target:=public.create_item(p_group_id,p_title,'spot','',p_request_id);
  insert into public.item_places(item_id,group_id,place_id) values(target,p_group_id,p_place_id);
 else was_saved:=true;
 end if;
 foreach list_id in array p_list_ids loop perform public.set_item_list(p_group_id,target,list_id,true); end loop;
 return query select target,was_saved,i.archived_at is not null from public.items i where i.id=target;
end; $$;
revoke all on function kokoiko_private.save_place_item(uuid,text,text,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function kokoiko_private.save_place_item(uuid,text,text,uuid[],uuid) to authenticated;
create function public.save_place_item(p_group_id uuid,p_place_id text,p_title text,p_list_ids uuid[],p_request_id uuid)
returns table(item_id uuid,reused boolean,archived boolean) language sql security invoker set search_path=''
as $$select * from kokoiko_private.save_place_item(p_group_id,p_place_id,p_title,p_list_ids,p_request_id)$$;
revoke all on function public.save_place_item(uuid,text,text,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_place_item(uuid,text,text,uuid[],uuid) to authenticated;

create function kokoiko_private.set_item_place(p_group_id uuid,p_item_id uuid,p_place_id text,p_expected_place_id text)
returns void language plpgsql security definer set search_path='' as $$
declare current_id text;
begin
 perform kokoiko_private.lock_place_group(p_group_id);
 perform 1 from public.items where id=p_item_id and group_id=p_group_id and kind='spot' for update;
 if not found then raise exception 'spot unavailable' using errcode='42501'; end if;
 if p_place_id is not null and (char_length(p_place_id) not between 1 and 255 or p_place_id !~ '^[A-Za-z0-9_-]+$') then raise exception 'invalid place' using errcode='22023'; end if;
 select place_id into current_id from public.item_places where item_id=p_item_id;
 if current_id is distinct from p_expected_place_id then raise exception 'place changed' using errcode='40001'; end if;
 if p_place_id is null then delete from public.item_places where item_id=p_item_id;
 else
  insert into public.item_places(item_id,group_id,place_id) values(p_item_id,p_group_id,p_place_id)
   on conflict(item_id) do update set place_id=excluded.place_id;
 end if;
end; $$;
revoke all on function kokoiko_private.set_item_place(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function kokoiko_private.set_item_place(uuid,uuid,text,text) to authenticated;
create function public.set_item_place(p_group_id uuid,p_item_id uuid,p_place_id text,p_expected_place_id text)
returns void language sql security invoker set search_path=''
as $$select kokoiko_private.set_item_place(p_group_id,p_item_id,p_place_id,p_expected_place_id)$$;
revoke all on function public.set_item_place(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_item_place(uuid,uuid,text,text) to authenticated;
commit;
