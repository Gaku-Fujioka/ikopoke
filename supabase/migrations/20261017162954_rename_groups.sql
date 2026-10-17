-- Ordinary group metadata is editable by every member (D-008).
begin;
create function public.rename_group(p_group_id uuid, p_name text, p_expected_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  trim_chars text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  clean_name text := btrim(p_name, trim_chars);
  existing_name text;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  perform 1 from public.group_members where group_id = p_group_id and user_id = actor for share;
  if not found then
    raise exception 'group unavailable' using errcode = '42501';
  end if;
  select name into existing_name from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'group unavailable' using errcode = '42501';
  end if;
  if clean_name is null or char_length(clean_name) not between 1 and 80 or clean_name !~ '[^[:space:]]' or p_expected_name is null then
    raise exception 'invalid group name' using errcode = '22023';
  end if;
  if existing_name = clean_name then return p_group_id; end if;
  if existing_name is distinct from p_expected_name then
    raise exception 'group changed since opened' using errcode = '40001';
  end if;
  update public.groups set name = clean_name where id = p_group_id;
  return p_group_id;
end;
$$;
revoke all on function public.rename_group(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rename_group(uuid, text, text) to authenticated;
commit;
