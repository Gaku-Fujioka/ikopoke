import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";

const { PGlite } = await import(process.env.KOKOIKO_PGLITE_MODULE_URL ?? "@electric-sql/pglite");
let db;
const alice="00000000-0000-4000-8000-000000000001", bob="00000000-0000-4000-8000-000000000002", outsider="00000000-0000-4000-8000-000000000003";
const group="10000000-0000-4000-8000-000000000001", otherGroup="10000000-0000-4000-8000-000000000002";
const cafe="20000000-0000-4000-8000-000000000001", park="20000000-0000-4000-8000-000000000002", otherItem="20000000-0000-4000-8000-000000000003";
const plan="30000000-0000-4000-8000-000000000001", plan2="30000000-0000-4000-8000-000000000002", plan3="30000000-0000-4000-8000-000000000003";
const fails=(promise,code)=>assert.rejects(promise,error=>error.code===code);
async function asUser(id,work,role="authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
  try{return await work();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}
}
const save=(id,revision,mode,items,participants=[alice,bob],groupId=group)=>db.query(
  "select public.save_outing($1,$2,$3,$4,$5,$6,$7,$8,$9) as revision",
  [groupId,id,revision,"週末のおでかけ","2026-10-25",mode,"メモ",JSON.stringify(items),participants]
);
const slots=[{item_id:cafe,planned_time:"10:30",period:"morning"},{item_id:park,planned_time:"14:00",period:"afternoon"}];

before(async()=>{
  db=await PGlite.create();
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    insert into auth.users(id) values('${alice}'),('${bob}'),('${outsider}');`);
  const migrations=(await readdir(new URL("../supabase/migrations/",import.meta.url))).filter(name=>name.endsWith(".sql")).sort();
  for(const name of migrations)await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  await asUser(alice,()=>db.query("select public.set_my_display_name('アリス')"));
  await asUser(bob,()=>db.query("select public.set_my_display_name('ボブ')"));
  await asUser(outsider,()=>db.query("select public.set_my_display_name('他人')"));
  await asUser(alice,()=>db.query("select public.create_group('A',$1)",[group]));
  await asUser(outsider,()=>db.query("select public.create_group('B',$1)",[otherGroup]));
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[group,bob]);
  await asUser(alice,()=>db.query("select public.create_item($1,'カフェ','spot','',$2)",[group,cafe]));
  await asUser(bob,()=>db.query("select public.create_item($1,'公園','spot','',$2)",[group,park]));
  await asUser(outsider,()=>db.query("select public.create_item($1,'別グループ','spot','',$2)",[otherGroup,otherItem]));
});
after(async()=>db?.close());

test("members create a dated plan with ordered items and selected participants",async()=>{
  assert.equal((await asUser(alice,()=>save(plan,0,"exact",slots))).rows[0].revision,1);
  const items=(await asUser(bob,()=>db.query("select item_id,position,planned_time::text,period from public.outing_items where outing_id=$1 order by position",[plan]))).rows;
  assert.deepEqual(items,[{item_id:cafe,position:0,planned_time:"10:30:00",period:"morning"},{item_id:park,position:1,planned_time:"14:00:00",period:"afternoon"}]);
  assert.deepEqual((await asUser(bob,()=>db.query("select user_id from public.outing_participants where outing_id=$1 order by user_id",[plan]))).rows,[{user_id:alice},{user_id:bob}]);
  assert.equal((await asUser(alice,()=>save(plan,0,"exact",slots))).rows[0].revision,1);
  assert.equal((await db.query("select count(*)::int as n from public.outings")).rows[0].n,1);
});

test("all members edit; switching modes preserves hidden slot values and source items",async()=>{
  const reordered=[slots[1],slots[0]];
  assert.equal((await asUser(bob,()=>save(plan,1,"order",reordered,[bob]))).rows[0].revision,2);
  assert.deepEqual((await asUser(alice,()=>db.query("select item_id,planned_time::text,period from public.outing_items where outing_id=$1 order by position",[plan]))).rows,
    [{item_id:park,planned_time:"14:00:00",period:"afternoon"},{item_id:cafe,planned_time:"10:30:00",period:"morning"}]);
  assert.equal((await asUser(alice,()=>save(plan,2,"period",reordered,[alice,bob]))).rows[0].revision,3);
  await asUser(bob,()=>fails(save(plan,1,"exact",slots),"40001"));
  assert.equal((await db.query("select count(*)::int as n from public.items where group_id=$1",[group])).rows[0].n,2);
});

test("foreign group IDs, unprofiled members and malformed slot input are rejected",async()=>{
  await asUser(alice,async()=>{
    await fails(save(plan2,0,"order",[{item_id:otherItem}], [alice]),"42501");
    await fails(save(plan2,0,"order",[{item_id:cafe}], [outsider]),"42501");
    await fails(save(plan2,0,"exact",[{item_id:cafe}], [alice]),"22023");
    await fails(save(plan2,0,"period",[{item_id:cafe}], [alice]),"22023");
    await fails(save(plan2,0,"order",[{item_id:cafe},{item_id:cafe}], [alice]),"23505");
    await fails(save(plan2,0,"order",[{item_id:cafe}], [alice,alice]),"22023");
  });
  assert.equal((await db.query("select count(*)::int as n from public.outings where id=$1",[plan2])).rows[0].n,0);
});

test("RLS and grants block outsiders, anonymous users, and direct mutation",async()=>{
  await asUser(outsider,async()=>{
    assert.deepEqual((await db.query("select id from public.outings where id=$1",[plan])).rows,[]);
    assert.deepEqual((await db.query("select item_id from public.outing_items where outing_id=$1",[plan])).rows,[]);
    assert.deepEqual((await db.query("select user_id from public.outing_participants where outing_id=$1",[plan])).rows,[]);
    await fails(save(plan,3,"order",slots),"42501");
    await fails(save(plan3,0,"order",[{item_id:cafe}],[outsider],otherGroup),"42501");
  });
  await asUser(alice,()=>fails(db.query("update public.outings set title='上書き' where id=$1",[plan]),"42501"));
  await asUser(null,async()=>{await fails(db.query("select id from public.outings"),"42501");await fails(save(plan3,0,"order",slots),"42501");},"anon");
});
