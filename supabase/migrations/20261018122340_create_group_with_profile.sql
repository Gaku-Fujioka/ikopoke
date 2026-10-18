-- Names and optional descriptions are committed together. Retry never edits a saved group.
begin;
create function kokoiko_private.create_group_with_profile(p_name text,p_request_id uuid,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existed boolean; result uuid;
begin
 if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
 if p_request_id is null or p_description is null or char_length(p_description)>500 then raise exception 'invalid group profile' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
 if not kokoiko_private.account_active(actor) then raise exception 'account unavailable' using errcode='55000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,702104));
 select exists(select 1 from public.groups where id=p_request_id) into existed;
 result:=public.create_group(p_name,p_request_id);
 perform kokoiko_private.lock_place_group(result);
 if not existed then update public.groups set description=btrim(p_description) where id=result; end if;
 return result;
end; $$;
create function public.create_group_with_profile(p_name text,p_request_id uuid,p_description text)
returns uuid language sql security invoker set search_path='' as $$select kokoiko_private.create_group_with_profile(p_name,p_request_id,p_description)$$;
revoke all on function public.create_group_with_profile(text,uuid,text),kokoiko_private.create_group_with_profile(text,uuid,text) from public,anon,authenticated;
grant execute on function public.create_group_with_profile(text,uuid,text),kokoiko_private.create_group_with_profile(text,uuid,text) to authenticated;
commit;
