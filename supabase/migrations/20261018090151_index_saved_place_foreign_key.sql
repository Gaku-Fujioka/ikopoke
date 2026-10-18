begin;
create index item_places_item_group_idx on public.item_places(item_id,group_id);
commit;
