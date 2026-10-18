import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { before, after, test } from "node:test";
import { createStorageFixture } from "./storage-fixture.mjs";
const { PGlite } = await import(process.env.KOKOIKO_PGLITE_MODULE_URL ?? "@electric-sql/pglite");
let db;
const alice="00000000-0000-4000-8000-000000000001", bob="00000000-0000-4000-8000-000000000002", outsider="00000000-0000-4000-8000-000000000003";
const group="10000000-0000-4000-8000-000000000001", second="10000000-0000-4000-8000-000000000002", hidden="10000000-0000-4000-8000-000000000003";
const item="20000000-0000-4000-8000-000000000001", other="20000000-0000-4000-8000-000000000002", plan="30000000-0000-4000-8000-000000000001", visit="40000000-0000-4000-8000-000000000001";
async function asUser(id, work, role="authenticated") {
  await db.exec(`set role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
  try { return await work(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
const feed=(id=null,limit=41,cursor=null)=>db.query("select * from public.get_home_activity($1,$2,$3,$4)",[id,limit,cursor?.occurred_at??null,cursor?.event_key??null]);
const fails=(promise,code)=>assert.rejects(promise,error=>error.code===code);
before(async()=>{
  db=await PGlite.create();
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;insert into auth.users values('${alice}'),('${bob}'),('${outsider}');`);
  await createStorageFixture(db);
  for(const name of (await readdir(new URL("../supabase/migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  await asUser(alice,async()=>{
    await db.query("select public.set_my_display_name('Alice')");
    for(const id of [group,second]) await db.query("select public.create_group('参加グループ',$1)",[id]);
    await db.query("select public.create_item($1,'共有カフェ','spot','',$2)",[group,item]);
    await db.query("select public.create_item($1,'別の参加先','activity','',$2)",[second,other]);
    await db.query("select public.save_outing($1,$2,0,'旅','2026-10-18','order','',$3,$4)",[group,plan,JSON.stringify([{item_id:item}]),[alice]]);
    await db.query("select public.record_timed_visit($1,$2,$3,'2026-10-18','',null,$4,null,null)",[group,item,plan,visit]);
    await db.query("select public.set_outing_completed($1,$2,true,1)",[group,plan]);
  });
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[group,bob]);
  await asUser(bob,async()=>{
    await db.query("select public.set_my_display_name('Bob')");
    await db.query("select public.set_item_reaction($1,$2,'want_to_go')",[group,item]);
    await db.query("select public.create_item_comment($1,$2,'private comment body',$3)",[group,item,"50000000-0000-4000-8000-000000000001"]);
  });
  await asUser(outsider,async()=>{await db.query("select public.create_group('秘密',$1)",[hidden]);await db.query("select public.create_item($1,'秘密の候補','spot','',$2)",[hidden,"20000000-0000-4000-8000-000000000003"]);});
});
after(async()=>db?.close());

test("home aggregates all and only joined groups and exposes safe display names across event types",async()=>{
  const rows=(await asUser(alice,()=>feed())).rows;
  assert.deepEqual(new Set(rows.map(row=>row.kind)),new Set(["item","want_to_go","comment","outing","visit","memory"]));
  assert.deepEqual(new Set(rows.map(row=>row.group_id)),new Set([group,second]));
  assert.equal(rows.find(row=>row.kind==="want_to_go").actor_name,"Bob");
  assert.equal(rows.find(row=>row.kind==="item").is_mine,true);
  assert.equal(rows.find(row=>row.kind==="memory").actor_name,null);
  const serialized=JSON.stringify(rows);
  for(const secret of [alice,bob,outsider,"private comment body","秘密"])assert.ok(!serialized.includes(secret));
  assert.ok(rows.every(row=>Object.keys(row).length===8&&/^[a-f0-9]{32}$/.test(row.event_key)));
});
test("explicit group reads, missing auth and anonymous execution enforce membership",async()=>{
  const rows=(await asUser(alice,()=>feed(second))).rows;assert.equal(rows.length,1);assert.equal(rows[0].title,"別の参加先");
  await asUser(bob,()=>fails(feed(second),"42501"));await asUser(outsider,()=>fails(feed(group),"42501"));
  await asUser(null,()=>fails(feed(),"28000"));await asUser(null,()=>fails(feed(),"42501"),"anon");
});
test("reaction updates replace current activity and cancellation removes it without exposing raw reactions",async()=>{
  await asUser(bob,()=>db.query("select public.set_item_reaction($1,$2,'not_now')",[group,item]));
  let rows=(await asUser(alice,()=>feed(group))).rows;
  assert.equal(rows.filter(row=>row.kind==="not_now").length,1);assert.equal(rows.filter(row=>row.kind==="want_to_go").length,0);
  assert.deepEqual((await asUser(alice,()=>db.query("select user_id from public.item_reactions"))).rows,[]);
  await asUser(bob,()=>db.query("select public.set_item_reaction($1,$2,null)",[group,item]));
  rows=(await asUser(alice,()=>feed(group))).rows;assert.ok(rows.every(row=>!['want_to_go','not_now'].includes(row.kind)));
});
test("keyset pages break timestamp ties and do not repeat cards when newer activity arrives",async()=>{
  await db.query("insert into public.items(id,group_id,title,kind,created_by,created_at) select ('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1,'同時候補','spot',$2,'2026-10-19T00:00:00Z' from generate_series(1,26)n",[group,alice]);
  const first=(await asUser(alice,()=>feed(group,20))).rows;
  assert.equal(first.length,20);
  await db.query("insert into public.items(id,group_id,title,kind,created_by,created_at) values('60000000-0000-4000-8000-000000000099',$1,'新着','spot',$2,'2026-10-20T00:00:00Z')",[group,alice]);
  const next=(await asUser(alice,()=>feed(group,20,first.at(-1)))).rows;
  assert.ok(next.length>6);assert.ok(next.every(row=>!first.some(prev=>prev.event_key===row.event_key)));assert.ok(!next.some(row=>row.title==="新着"));
  assert.equal([...first,...next].filter(row=>row.title==="同時候補").length,26);
});
test("former member names are hidden immediately and membership removal revokes all access",async()=>{
  await db.query("delete from public.group_members where group_id=$1 and user_id=$2",[group,bob]);
  const rows=(await asUser(alice,()=>feed(group))).rows;
  assert.equal(rows.find(row=>row.kind==="comment").actor_name,"退出したメンバー");
  await asUser(bob,()=>fails(feed(group),"42501"));assert.equal((await asUser(bob,()=>feed())).rows.length,0);
});
test("unbounded pages and incomplete or invalid cursors are rejected",async()=>{
  await asUser(alice,async()=>{
    for(const limit of [null,0,42])await fails(feed(null,limit),"22023");
    await fails(db.query("select * from public.get_home_activity(null,20,now(),null)"),"22023");
    await fails(db.query("select * from public.get_home_activity(null,20,now(),'bad')"),"22023");
  });
});
