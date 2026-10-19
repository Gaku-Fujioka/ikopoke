-- FINANCE-01: owner-only money records, independent from shared group retention.
begin;
create table public.finance_categories(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 40 and name~'[^[:space:]]'),default_key text,
 revision integer not null default 1 check(revision>0),created_at timestamptz not null default now(),
 unique(owner_id,id),unique(owner_id,default_key)
);
create unique index finance_category_name_idx on public.finance_categories(owner_id,lower(name));
create table public.finance_contexts(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('outing','visit')),source_id uuid not null,group_id uuid not null,
 outing_id uuid,group_name text not null,title text not null,outing_title text,occurred_on date not null,
 created_at timestamptz not null default now(),unique(owner_id,id),unique(owner_id,kind,source_id)
);
-- Source identifiers deliberately have no shared-table FK: snapshots survive exit/deletion.
create index finance_context_outing_idx on public.finance_contexts(owner_id,outing_id);
create index finance_context_group_idx on public.finance_contexts(owner_id,group_id);
create table public.finance_entries(
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 context_id uuid not null,kind text not null check(kind in ('expense','receive','pay')),
 title text not null check(char_length(title) between 1 and 100 and title~'[^[:space:]]'),
 amount integer not null check(amount between 1 and 1000000000),occurred_on date not null check(occurred_on between date '1900-01-01' and date '2199-12-31'),
 category_id uuid not null,expense_id uuid,party_name text not null default '' check(char_length(party_name)<=80),
 memo text not null default '' check(char_length(memo)<=1000),revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,id),
 foreign key(owner_id,context_id) references public.finance_contexts(owner_id,id) on delete cascade,
 foreign key(owner_id,category_id) references public.finance_categories(owner_id,id),
 foreign key(owner_id,expense_id) references public.finance_entries(owner_id,id) on delete cascade,
 check((kind='receive') or expense_id is null),check(kind='expense' or char_length(party_name)>0)
);
create index finance_entries_date_idx on public.finance_entries(owner_id,occurred_on desc,id);
create index finance_entries_context_idx on public.finance_entries(owner_id,context_id,occurred_on);
create index finance_entries_category_idx on public.finance_entries(owner_id,category_id);
create index finance_entries_expense_idx on public.finance_entries(owner_id,expense_id);
create table public.finance_payments(
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,entry_id uuid not null,
 amount integer not null check(amount between 1 and 1000000000),paid_on date not null check(paid_on between date '1900-01-01' and date '2199-12-31'),
 memo text not null default '' check(char_length(memo)<=200),revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),foreign key(owner_id,entry_id) references public.finance_entries(owner_id,id) on delete cascade
);
create index finance_payments_entry_idx on public.finance_payments(owner_id,entry_id,paid_on,id);
-- Only hashes/UUIDs remain after record deletion, preventing stale retries from recreating it.
create table kokoiko_private.finance_requests(
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,kind text not null,
 fingerprint text not null,created_at timestamptz not null default now()
);
create index finance_requests_owner_idx on kokoiko_private.finance_requests(owner_id);
alter table kokoiko_private.finance_requests enable row level security;
revoke all on kokoiko_private.finance_requests from public,anon,authenticated;

create function kokoiko_private.finance_active() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and kokoiko_private.account_active(auth.uid())
$$;
revoke all on function kokoiko_private.finance_active() from public,anon,authenticated;
grant execute on function kokoiko_private.finance_active() to authenticated;
do $$declare t text;begin
 foreach t in array array['finance_categories','finance_contexts','finance_entries','finance_payments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for select to authenticated using(owner_id=(select auth.uid()) and (select kokoiko_private.finance_active()))',t||'_read_own',t);
 end loop;
end; $$;

create function kokoiko_private.finance_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); labels text[]:=array['食事','カフェ','交通','宿泊','買い物','チケット','その他'];n integer;
begin
 if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,702101));
 if not kokoiko_private.account_active(actor) then raise exception 'account unavailable' using errcode='55000'; end if;
 if (select count(*) from public.finance_categories where owner_id=actor and default_key is not null)<7 then
  for n in 1..7 loop
   insert into public.finance_categories(owner_id,name,default_key) values(actor,labels[n],n::text) on conflict(owner_id,default_key) do nothing;
  end loop;
 end if;
 return actor;
end; $$;
create function kokoiko_private.finance_request(p_id uuid,p_kind text,p_data jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare r kokoiko_private.finance_requests%rowtype; h text:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
begin
 if p_id is null then raise exception 'request required' using errcode='22023'; end if;
 select * into r from kokoiko_private.finance_requests where id=p_id;
 if found then
  if r.owner_id is distinct from auth.uid() or r.kind<>p_kind or r.fingerprint<>h then raise exception 'request reused' using errcode='23505'; end if;
  return true;
 end if;
 insert into kokoiko_private.finance_requests(id,owner_id,kind,fingerprint) values(p_id,auth.uid(),p_kind,h);
 return false;
end; $$;

create function kokoiko_private.open_finance_context(p_kind text,p_source uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=kokoiko_private.finance_actor(); result uuid;gid uuid;o public.outings%rowtype;v public.visits%rowtype;gname text;
begin
 if p_kind not in ('outing','visit') or p_source is null then raise exception 'invalid context' using errcode='22023'; end if;
 select id into result from public.finance_contexts where owner_id=actor and kind=p_kind and source_id=p_source;
 if found then return result; end if;
 if p_kind='outing' then select group_id into gid from public.outings where id=p_source;
 else select group_id into gid from public.visits where id=p_source and not deleting; end if;
 if gid is null then raise exception 'context unavailable' using errcode='42501'; end if;
 perform kokoiko_private.lock_place_group(gid);
 select name into gname from public.groups where id=gid;
 if p_kind='outing' then
  select * into o from public.outings where id=p_source and group_id=gid for share;
  if not found then raise exception 'context unavailable' using errcode='42501'; end if;
  insert into public.finance_contexts(owner_id,kind,source_id,group_id,outing_id,group_name,title,outing_title,occurred_on)
   values(actor,p_kind,p_source,gid,o.id,gname,o.title,o.title,o.outing_date) returning id into result;
 else
  select * into v from public.visits where id=p_source and group_id=gid and not deleting for share;
  if not found then raise exception 'context unavailable' using errcode='42501'; end if;
  if v.outing_id is not null then
   perform kokoiko_private.open_finance_context('outing',v.outing_id);
   select * into o from public.outings where id=v.outing_id;
  end if;
  insert into public.finance_contexts(owner_id,kind,source_id,group_id,outing_id,group_name,title,outing_title,occurred_on)
   values(actor,p_kind,p_source,gid,v.outing_id,gname,v.item_title,o.title,v.visited_on) returning id into result;
 end if;
 return result;
end; $$;
create function public.open_finance_context(p_kind text,p_source uuid) returns uuid language sql security invoker set search_path='' as $$select kokoiko_private.open_finance_context(p_kind,p_source)$$;

create function kokoiko_private.get_finance_options(p_context uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=kokoiko_private.finance_actor();ctx public.finance_contexts%rowtype;members jsonb:='[]';accessible boolean:=false;
begin
 if p_context is not null then
  select * into ctx from public.finance_contexts where id=p_context and owner_id=actor;
  if not found then raise exception 'context unavailable' using errcode='42501'; end if;
  accessible:=exists(select 1 from public.groups g join public.group_members m on m.group_id=g.id where g.id=ctx.group_id and not g.deleting and m.user_id=actor);
  accessible:=accessible and case when ctx.kind='outing' then exists(select 1 from public.outings where id=ctx.source_id) else exists(select 1 from public.visits where id=ctx.source_id and not deleting) end;
  if accessible then
   select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name) order by p.display_name),'[]') into members
    from public.group_members m join public.profiles p on p.user_id=m.user_id where m.group_id=ctx.group_id and m.user_id<>actor and p.display_name is not null;
  end if;
 end if;
 return jsonb_build_object(
  'categories',(select coalesce(jsonb_agg(to_jsonb(c)-'owner_id'-'default_key' order by coalesce(c.default_key::integer,99),c.created_at,c.id),'[]') from public.finance_categories c where c.owner_id=actor),
  'contexts',(select coalesce(jsonb_agg(to_jsonb(c)-'owner_id' order by c.occurred_on desc,c.id),'[]') from (select * from public.finance_contexts where owner_id=actor order by occurred_on desc,id limit 500) c),
  'context',case when p_context is null then null else (to_jsonb(ctx)-'owner_id')||jsonb_build_object('accessible',accessible) end,
  'members',members,
  'sources',case when p_context is not null then '[]'::jsonb else (
   select coalesce(jsonb_agg(x order by x->>'occurred_on' desc),'[]') from (
    (select jsonb_build_object('kind','outing','id',o.id,'title',o.title,'occurred_on',o.outing_date,'group_name',g.name) x
     from public.outings o join public.groups g on g.id=o.group_id join public.group_members m on m.group_id=g.id and m.user_id=actor where not g.deleting order by o.outing_date desc,o.id limit 20)
    union all
    (select jsonb_build_object('kind','visit','id',v.id,'title',v.item_title,'occurred_on',v.visited_on,'group_name',g.name)
     from public.visits v join public.groups g on g.id=v.group_id join public.group_members m on m.group_id=g.id and m.user_id=actor where not g.deleting and not v.deleting order by v.visited_on desc,v.id limit 20)
   ) recent
  ) end);
end; $$;
create function public.get_finance_options(p_context uuid) returns jsonb language sql security invoker set search_path='' as $$select kokoiko_private.get_finance_options(p_context)$$;

create function kokoiko_private.save_finance_category(p_id uuid,p_name text,p_expected integer) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=kokoiko_private.finance_actor();rev integer;
begin
 if p_id is null or p_name is null or char_length(btrim(p_name)) not between 1 and 40 or p_expected is null or p_expected<0 then raise exception 'invalid category' using errcode='22023'; end if;
 if p_expected=0 then
  select revision into rev from public.finance_categories where id=p_id and owner_id=actor and name=btrim(p_name);
  if found then return rev; end if;
  if (select count(*) from public.finance_categories where owner_id=actor)>=50 then raise exception 'category limit' using errcode='54000'; end if;
  insert into public.finance_categories(id,owner_id,name) values(p_id,actor,btrim(p_name)) on conflict(id) do nothing returning revision into rev;
  if rev is null then select revision into rev from public.finance_categories where id=p_id and owner_id=actor and name=btrim(p_name); end if;
  if rev is null then raise exception 'request conflict' using errcode='23505'; end if;
 else
  update public.finance_categories set name=btrim(p_name),revision=revision+1 where id=p_id and owner_id=actor and revision=p_expected returning revision into rev;
  if rev is null then raise exception 'category changed' using errcode='40001'; end if;
 end if;
 return rev;
end; $$;
create function public.save_finance_category(p_id uuid,p_name text,p_expected integer) returns integer language sql security invoker set search_path='' as $$select kokoiko_private.save_finance_category(p_id,p_name,p_expected)$$;

create function kokoiko_private.save_finance_entry(p_id uuid,p_expected integer,p_data jsonb) returns integer language plpgsql security definer set search_path='' as $$
<<entry_values>>
declare actor uuid:=kokoiko_private.finance_actor();e public.finance_entries%rowtype;parent public.finance_entries%rowtype;ctx public.finance_contexts%rowtype;
 k text:=p_data->>'kind';cid uuid:=(p_data->>'context_id')::uuid;cat uuid:=(p_data->>'category_id')::uuid;parent_id uuid:=nullif(p_data->>'expense_id','')::uuid;
 party text:=btrim(coalesce(p_data->>'party_name',''));member_id uuid:=nullif(p_data->>'member_id','')::uuid;title text:=btrim(p_data->>'title');memo text:=coalesce(p_data->>'memo','');
 amount integer;day date;rev integer;settled bigint;
begin
 if p_id is null or p_expected is null or p_expected<0 or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid entry' using errcode='22023'; end if;
 if p_expected=0 and kokoiko_private.finance_request(p_id,'entry',p_data) then
  select revision into rev from public.finance_entries where id=p_id and owner_id=actor;
  if rev is null then raise exception 'entry was removed' using errcode='55000'; end if;return rev;
 end if;
 if k is null or k not in ('expense','receive','pay') or title is null or char_length(title) not between 1 and 100 or char_length(memo)>1000 or
  coalesce(p_data->>'amount','')!~'^[0-9]{1,10}$' or coalesce(p_data->>'occurred_on','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid entry' using errcode='22023'; end if;
 amount:=(p_data->>'amount')::integer;day:=(p_data->>'occurred_on')::date;
 if amount not between 1 and 1000000000 or day not between date '1900-01-01' and date '2199-12-31' then raise exception 'invalid amount or date' using errcode='22023'; end if;
 select * into ctx from public.finance_contexts where id=cid and owner_id=actor;
 if not found then raise exception 'context unavailable' using errcode='42501'; end if;
 if parent_id is not null then
  select * into parent from public.finance_entries where id=parent_id and owner_id=actor and kind='expense' for update;
  if not found or k<>'receive' or parent.context_id<>cid then raise exception 'expense unavailable' using errcode='42501'; end if;
  if parent.revision is distinct from (p_data->>'expense_revision')::integer then raise exception 'expense changed' using errcode='40001'; end if;
  day:=parent.occurred_on;cat:=parent.category_id;
 end if;
 if not exists(select 1 from public.finance_categories where id=cat and owner_id=actor) then raise exception 'category unavailable' using errcode='42501'; end if;
 if k='expense' then party:='';
 elsif member_id is not null then
  if member_id=actor then raise exception 'choose another member' using errcode='22023'; end if;
  if not exists(select 1 from public.group_members m join public.groups g on g.id=m.group_id where m.group_id=ctx.group_id and m.user_id=actor and not g.deleting) then raise exception 'member unavailable' using errcode='42501'; end if;
  select p.display_name into party from public.group_members m join public.profiles p on p.user_id=m.user_id where m.group_id=ctx.group_id and m.user_id=member_id;
  if party is null then raise exception 'member unavailable' using errcode='42501'; end if;
 end if;
 if party is null or char_length(party)>80 or (k<>'expense' and (char_length(party)=0 or party!~'[^[:space:]]')) then raise exception 'counterparty required' using errcode='22023'; end if;
 if p_expected=0 then
  insert into public.finance_entries(id,owner_id,context_id,kind,title,amount,occurred_on,category_id,expense_id,party_name,memo)
   values(p_id,actor,cid,k,title,amount,day,cat,parent_id,party,memo) returning revision into rev;
 else
  select * into e from public.finance_entries where id=p_id and owner_id=actor for update;
  if not found then raise exception 'entry unavailable' using errcode='42501'; end if;
  if e.revision<>p_expected then raise exception 'entry changed' using errcode='40001'; end if;
  if e.kind<>k or e.context_id<>cid or e.expense_id is distinct from parent_id then raise exception 'entry identity changed' using errcode='22023'; end if;
  select coalesce(sum(p.amount),0) into settled from public.finance_payments p where p.entry_id=e.id and p.owner_id=actor;
  if amount<settled then raise exception 'amount below settled total' using errcode='22023'; end if;
  update public.finance_entries set title=entry_values.title,amount=entry_values.amount,occurred_on=day,category_id=cat,party_name=party,memo=entry_values.memo,revision=revision+1,updated_at=now()
   where id=p_id returning revision into rev;
  if k='expense' then update public.finance_entries set occurred_on=day,category_id=cat,revision=revision+1,updated_at=now() where owner_id=actor and expense_id=p_id; end if;
 end if;
 if parent_id is not null then update public.finance_entries set revision=revision+1,updated_at=now() where id=parent_id and owner_id=actor; end if;
 return rev;
end; $$;
create function public.save_finance_entry(p_id uuid,p_expected integer,p_data jsonb) returns integer language sql security invoker set search_path='' as $$select kokoiko_private.save_finance_entry(p_id,p_expected,p_data)$$;

create function kokoiko_private.save_finance_payment(p_entry uuid,p_id uuid,p_expected integer,p_payment_revision integer,p_data jsonb,p_delete boolean)
returns integer language plpgsql security definer set search_path='' as $$
<<payment_values>>
declare actor uuid:=kokoiko_private.finance_actor();e public.finance_entries%rowtype;p public.finance_payments%rowtype;amount integer;day date;memo text:=coalesce(p_data->>'memo','');total bigint;rev integer;
begin
 if p_entry is null or p_id is null or p_expected is null or p_expected<1 or p_payment_revision is null or p_payment_revision<0 or p_delete is null or (p_delete and p_payment_revision<1) then raise exception 'invalid history' using errcode='22023'; end if;
 select * into e from public.finance_entries where id=p_entry and owner_id=actor for update;
 if not found or e.kind='expense' then raise exception 'entry unavailable' using errcode='42501'; end if;
 select * into p from public.finance_payments where id=p_id and owner_id=actor and entry_id=p_entry;
 if p_delete and not found then return e.revision; end if;
 if not p_delete and p_payment_revision=0 and kokoiko_private.finance_request(p_id,'payment',p_data||jsonb_build_object('entry_id',p_entry)) then
  if p.id is null then raise exception 'history was removed' using errcode='55000'; end if;return e.revision;
 end if;
 if e.revision<>p_expected then raise exception 'entry changed' using errcode='40001'; end if;
 if p_payment_revision>0 and (p.id is null or p.revision<>p_payment_revision) then raise exception 'history changed' using errcode='40001'; end if;
 if p_delete then delete from public.finance_payments where id=p_id and owner_id=actor and entry_id=p_entry;
 else
  if coalesce(p_data->>'amount','')!~'^[0-9]{1,10}$' or coalesce(p_data->>'paid_on','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or char_length(memo)>200 then raise exception 'invalid payment' using errcode='22023'; end if;
  amount:=(p_data->>'amount')::integer;day:=(p_data->>'paid_on')::date;
  if amount not between 1 and 1000000000 or day not between date '1900-01-01' and date '2199-12-31' then raise exception 'invalid payment' using errcode='22023'; end if;
  select coalesce(sum(x.amount),0) into total from public.finance_payments x where x.owner_id=actor and x.entry_id=p_entry and x.id<>p_id;
  if total+amount>e.amount then raise exception 'payment exceeds remaining amount' using errcode='22023'; end if;
  if p_payment_revision=0 then insert into public.finance_payments(id,owner_id,entry_id,amount,paid_on,memo) values(p_id,actor,p_entry,amount,day,memo);
  else update public.finance_payments set amount=payment_values.amount,paid_on=day,memo=payment_values.memo,revision=revision+1 where id=p_id and owner_id=actor; end if;
 end if;
 update public.finance_entries set revision=revision+1,updated_at=now() where id=p_entry and owner_id=actor returning revision into rev;
 if e.expense_id is not null then update public.finance_entries set revision=revision+1,updated_at=now() where id=e.expense_id and owner_id=actor; end if;
 return rev;
end; $$;
create function public.save_finance_payment(p_entry uuid,p_id uuid,p_expected integer,p_payment_revision integer,p_data jsonb,p_delete boolean)
returns integer language sql security invoker set search_path='' as $$select kokoiko_private.save_finance_payment(p_entry,p_id,p_expected,p_payment_revision,p_data,p_delete)$$;

create function kokoiko_private.delete_finance_entry(p_id uuid,p_expected integer,p_confirm boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=kokoiko_private.finance_actor();e public.finance_entries%rowtype;
begin
 if p_confirm is distinct from true or p_expected is null or p_expected<1 then raise exception 'confirmation required' using errcode='22023'; end if;
 select * into e from public.finance_entries where id=p_id and owner_id=actor for update;
 if not found then raise exception 'entry unavailable' using errcode='42501'; end if;
 if e.revision<>p_expected then raise exception 'entry changed' using errcode='40001'; end if;
 delete from public.finance_entries where id=e.id and owner_id=actor;
 if e.expense_id is not null then update public.finance_entries set revision=revision+1,updated_at=now() where id=e.expense_id and owner_id=actor; end if;
end; $$;
create function public.delete_finance_entry(p_id uuid,p_expected integer,p_confirm boolean) returns void language sql security invoker set search_path='' as $$select kokoiko_private.delete_finance_entry(p_id,p_expected,p_confirm)$$;

create function kokoiko_private.get_finance_entry(p_id uuid,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=kokoiko_private.finance_actor();e public.finance_entries%rowtype;total bigint;result jsonb;
begin
 if p_page is null or p_page not between 1 and 100000 then raise exception 'invalid page' using errcode='22023'; end if;
 select * into e from public.finance_entries where id=p_id and owner_id=actor;
 if not found then raise exception 'entry unavailable' using errcode='42501'; end if;
 select coalesce(sum(p.amount),0) into total from public.finance_payments p where p.entry_id=e.id and p.owner_id=actor;
 result:=jsonb_build_object('entry',to_jsonb(e)-'owner_id','settled',total,'remaining',case when e.kind='expense' then 0 else e.amount-total end,
  'payments',(select coalesce(jsonb_agg(to_jsonb(p)-'owner_id' order by p.paid_on desc,p.id),'[]') from (select * from public.finance_payments where entry_id=e.id and owner_id=actor order by paid_on desc,id limit 20 offset (p_page-1)*20) p),
  'payment_count',(select count(*) from public.finance_payments where entry_id=e.id and owner_id=actor),
  'receivables',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'amount',r.amount,'party_name',r.party_name) order by r.created_at,r.id),'[]') from public.finance_entries r where r.expense_id=e.id and r.owner_id=actor));
 return result;
end; $$;
create function public.get_finance_entry(p_id uuid,p_page integer) returns jsonb language sql security invoker set search_path='' as $$select kokoiko_private.get_finance_entry(p_id,p_page)$$;

create function kokoiko_private.get_finance_dashboard(p_context uuid,p_month text,p_kind text,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=kokoiko_private.finance_actor();ctx public.finance_contexts%rowtype;first_day date;last_day date;result jsonb;
begin
 if p_kind is null or p_kind not in ('expense','receive','pay') or p_page is null or p_page not between 1 and 100000 then raise exception 'invalid query' using errcode='22023'; end if;
 if p_month is not null then
  if p_month!~'^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'invalid month' using errcode='22023'; end if;
  first_day:=(p_month||'-01')::date;last_day:=(first_day+interval '1 month')::date;
 end if;
 if p_context is not null then
  select * into ctx from public.finance_contexts where id=p_context and owner_id=actor;
  if not found then raise exception 'context unavailable' using errcode='42501'; end if;
 end if;
 with base as (
  select e.*,c.title context_title,c.group_name,c.outing_title,k.name category_name,
   coalesce((select sum(p.amount) from public.finance_payments p where p.entry_id=e.id and p.owner_id=actor),0) settled
  from public.finance_entries e join public.finance_contexts c on c.id=e.context_id and c.owner_id=actor
  join public.finance_categories k on k.id=e.category_id and k.owner_id=actor
  where e.owner_id=actor and (first_day is null or (e.occurred_on>=first_day and e.occurred_on<last_day))
   and (p_context is null or c.id=ctx.id or (ctx.kind='outing' and c.outing_id=ctx.outing_id))
 ), rows as (
  select e.id,e.id entry_id,e.kind,e.title,e.amount,e.occurred_on,null::date paid_on,e.category_name,e.context_title,e.group_name,e.party_name,e.settled,
   case when e.kind='expense' then 0 else e.amount-e.settled end remaining,false automatic
   from base e where e.kind=p_kind
  union all
  select p.id,e.id,e.kind,e.title,p.amount,e.occurred_on,p.paid_on,e.category_name,e.context_title,e.group_name,e.party_name,p.amount,0,true
   from base e join public.finance_payments p on p.entry_id=e.id and p.owner_id=actor where p_kind='expense' and e.kind='pay'
 ), totals as (
  select coalesce(sum(case when kind='expense' then amount when kind='pay' then settled else 0 end),0) paid,
   coalesce(sum(case when kind='receive' then settled else 0 end),0) received,
   coalesce(sum(case when kind='receive' then amount-settled else 0 end),0) receive_remaining,
   coalesce(sum(case when kind='pay' then amount-settled else 0 end),0) pay_remaining,
   coalesce(sum(case when kind='receive' then -amount else amount end),0) forecast
  from base
 ), breakdown as (
  select category_id,category_name,coalesce(sum(case when kind='receive' then -amount else amount end),0) forecast
  from base group by category_id,category_name
 ) select jsonb_build_object('totals',(select to_jsonb(t) from totals t),
  'breakdown',(select coalesce(jsonb_agg(to_jsonb(b) order by b.forecast desc,b.category_name),'[]') from breakdown b),
  'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_on desc,r.id),'[]') from (select * from rows order by occurred_on desc,id limit 30 offset (p_page-1)*30) r),
  'total_count',(select count(*) from rows)) into result;
 return result;
end; $$;
create function public.get_finance_dashboard(p_context uuid,p_month text,p_kind text,p_page integer) returns jsonb language sql security invoker set search_path='' as $$select kokoiko_private.get_finance_dashboard(p_context,p_month,p_kind,p_page)$$;

create function kokoiko_private.cleanup_finance_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='data_removed' and old.state='pending' then
  delete from public.finance_contexts where owner_id=new.user_id;
  delete from public.finance_categories where owner_id=new.user_id;
  delete from kokoiko_private.finance_requests where owner_id=new.user_id;
 end if;
 return new;
end; $$;
create trigger cleanup_finance_account before update on kokoiko_private.account_deletions for each row execute function kokoiko_private.cleanup_finance_account();

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','kokoiko_private') and p.proname in ('open_finance_context','get_finance_options','save_finance_category','save_finance_entry','save_finance_payment','delete_finance_entry','get_finance_entry','get_finance_dashboard') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
revoke all on function kokoiko_private.finance_actor(),kokoiko_private.finance_request(uuid,text,jsonb),kokoiko_private.cleanup_finance_account() from public,anon,authenticated;
commit;
