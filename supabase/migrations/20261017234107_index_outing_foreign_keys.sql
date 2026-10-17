-- Cover the composite foreign keys used by outing edits and membership checks.
begin;
create index outing_items_outing_group_idx on public.outing_items(outing_id, group_id);
create index outing_participants_outing_group_idx on public.outing_participants(outing_id, group_id);
create index outing_participants_group_user_idx on public.outing_participants(group_id, user_id);
commit;
