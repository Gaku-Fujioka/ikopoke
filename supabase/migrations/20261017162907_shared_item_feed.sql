-- PostgreSQL 15+ invoker view: underlying item/reaction RLS still applies.
begin;
create view public.shared_item_feed with (security_invoker = true) as
  select item.id, item.group_id, item.title, item.kind, item.memo, item.created_at,
    (select reaction.value from public.item_reactions as reaction
      where reaction.item_id = item.id and reaction.user_id = (select auth.uid())) as my_reaction
  from public.items as item;
revoke all on public.shared_item_feed from public, anon, authenticated;
grant select on public.shared_item_feed to authenticated;
commit;
