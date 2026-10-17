-- Member editing of names and memos only. Inspect target before applying.
begin;

create function public.update_item(
  p_group_id uuid, p_item_id uuid, p_title text, p_memo text,
  p_expected_title text, p_expected_memo text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  trim_chars text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  clean_title text := btrim(p_title, trim_chars);
  clean_memo text := btrim(coalesce(p_memo, ''), trim_chars);
  existing public.items%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  -- Keep membership valid until this transaction finishes.
  perform 1 from public.group_members
    where group_id = p_group_id and user_id = actor for share;
  if not found then
    raise exception 'candidate unavailable' using errcode = '42501';
  end if;
  select * into existing from public.items
    where id = p_item_id and group_id = p_group_id for update;
  if not found then
    raise exception 'candidate unavailable' using errcode = '42501';
  end if;
  if clean_title is null or char_length(clean_title) not between 1 and 100 or
     clean_title !~ '[^[:space:]]' or char_length(clean_memo) > 2000 or
     p_expected_title is null or p_expected_memo is null then
    raise exception 'invalid item input' using errcode = '22023';
  end if;
  -- Retrying an already completed save is harmless. A stale editor cannot
  -- overwrite a different current value, including changes by another member.
  if existing.title = clean_title and existing.memo = clean_memo then
    return existing.id;
  end if;
  if existing.title is distinct from p_expected_title or existing.memo is distinct from p_expected_memo then
    raise exception 'item changed since opened' using errcode = '40001';
  end if;
  update public.items set title = clean_title, memo = clean_memo where id = existing.id;
  return existing.id;
end;
$$;

revoke all on function public.update_item(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_item(uuid, uuid, text, text, text, text) to authenticated;
commit;
