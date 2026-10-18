-- Current shared activity, not an append-only audit log. No auth identifiers or
-- comment bodies are returned. Reaction cancellation removes its activity card.
begin;

create function public.get_home_activity(
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
  select e.k, e.g, e.t, e.subject, e.label, p.display_name,
    coalesce(e.who = actor, false), e.at
    from page e
    -- Do not disclose a former member's current account profile.
    left join public.group_members member on member.group_id = e.g and member.user_id = e.who
    left join public.profiles p on p.user_id = member.user_id
    order by e.at desc, e.k desc;
end;
$$;
revoke all on function public.get_home_activity(uuid, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function public.get_home_activity(uuid, integer, timestamptz, text) to authenticated;

commit;
