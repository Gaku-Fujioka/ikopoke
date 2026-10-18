import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {before,after,test} from "node:test";
import {createStorageFixture} from "./storage-fixture.mjs";
const {PGlite}=await import(process.env.KOKOIKO_PGLITE_MODULE_URL??"@electric-sql/pglite");
let db,memory;
const alice="00000000-0000-4000-8000-000000000001",bob="00000000-0000-4000-8000-000000000002",outsider="00000000-0000-4000-8000-000000000003";
const group="10000000-0000-4000-8000-000000000001",otherGroup="10000000-0000-4000-8000-000000000002",item="20000000-0000-4000-8000-000000000001",otherItem="20000000-0000-4000-8000-000000000002",plan="30000000-0000-4000-8000-000000000001",visit="40000000-0000-4000-8000-000000000001",photo="50000000-0000-4000-8000-000000000001";
async function asUser(id,work,role="authenticated"){
  await db.exec(`set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
  try{return await work();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}
}
const fails=(promise,code)=>assert.rejects(promise,error=>error.code===code);
const record=(time,period)=>db.query("select public.record_timed_visit($1,$2,$3,'2026-10-18','メモ',null,$4,$5,$6) as id",[group,item,plan,visit,time,period]);
const complete=(value,revision,groupId=group)=>db.query("select public.set_outing_completed($1,$2,$3,$4) as id",[groupId,plan,value,revision]);
before(async()=>{
  db=await PGlite.create();await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;insert into auth.users values('${alice}'),('${bob}'),('${outsider}');`);
  await createStorageFixture(db);
  for(const name of (await readdir(new URL("../supabase/migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort())await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  await asUser(alice,async()=>{await db.query("select public.set_my_display_name('A')");await db.query("select public.create_group('A',$1)",[group]);for(const id of [item,otherItem])await db.query("select public.create_item($1,'訪問先','spot','',$2)",[group,id]);await db.query("select public.save_outing($1,$2,0,'旅','2026-10-18','order','計画メモ',$3,$4)",[group,plan,JSON.stringify([{item_id:item}]),[alice]]);});
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[group,bob]);
  await asUser(outsider,()=>db.query("select public.create_group('B',$1)",[otherGroup]));
});
after(async()=>db?.close());
test("optional visit time is atomic, validated and not overwritten by a retried creation",async()=>{
  await asUser(alice,async()=>{
    await fails(record("24:00",null),"22023");await fails(record("10:00:30",null),"22023");await fails(record("10:00","morning"),"22023");await fails(record(null,"unknown"),"22023");
    await record("10:15",null);await record("10:15",null);await fails(record("10:16",null),"23505");
    assert.deepEqual((await db.query("select visited_time,visited_period,revision from public.visits where id=$1",[visit])).rows,[{visited_time:"10:15:00",visited_period:null,revision:1}]);
  });
  await asUser(bob,async()=>{await db.query("select public.update_timed_visit($1,$2,'2026-10-18','時間帯へ',1,null,'afternoon')",[group,visit]);await fails(db.query("select public.update_timed_visit($1,$2,'2026-10-18','古い',1,null,null)",[group,visit]),"40001");});
});
test("finishing creates one album and retries preserve it without marking unvisited candidates",async()=>{
  memory=(await asUser(alice,()=>complete(true,1))).rows[0].id;
  assert.equal((await asUser(bob,()=>complete(true,1))).rows[0].id,memory);
  assert.equal((await db.query("select count(*)::int as n from public.memories")).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int as n from public.visits")).rows[0].n,1);
  assert.deepEqual((await asUser(bob,()=>db.query("select title,memory_date::text,note from public.memories"))).rows,[{title:"旅",memory_date:"2026-10-18",note:"計画メモ"}]);
  await asUser(alice,()=>fails(db.query("select public.save_outing($1,$2,2,'変更','2026-10-18','order','',$3,$4)",[group,plan,JSON.stringify([{item_id:item}]),[alice]]),"22023"));
});
test("shared album edits reject stale revisions and blank Unicode titles",async()=>{
  await asUser(bob,async()=>{assert.equal((await db.query("select public.update_memory($1,$2,'表紙','あとがき',1) as revision",[group,memory])).rows[0].revision,2);await fails(db.query("select public.update_memory($1,$2,'上書き','',1)",[group,memory]),"40001");await fails(db.query("select public.update_memory($1,$2,$3,'',2)",[group,memory,"\u3000\u00a0"]),"22023");});
});
test("completion undo and refinish reuse the album and keep visits removed from the plan",async()=>{
  assert.equal((await asUser(bob,()=>complete(false,2))).rows[0].id,memory);
  assert.equal((await db.query("select completed_at from public.outings where id=$1",[plan])).rows[0].completed_at,null);
  await asUser(alice,()=>fails(complete(true,1),"40001"));
  await asUser(alice,()=>db.query("select public.save_outing($1,$2,3,'新計画','2026-10-20','order','新メモ',$3,$4)",[group,plan,JSON.stringify([{item_id:otherItem}]),[alice]]));
  assert.equal((await asUser(bob,()=>complete(true,4))).rows[0].id,memory);
  const saved=(await db.query("select title,note,memory_date::text from public.memories where id=$1",[memory])).rows[0];assert.equal(saved.title,"表紙");assert.equal(saved.note,"あとがき");assert.equal(saved.memory_date,"2026-10-18");
  assert.equal((await db.query("select outing_id from public.visits where id=$1",[visit])).rows[0].outing_id,plan);
});
test("post-completion visit notes and ready photos remain live and group protected",async()=>{
  await asUser(alice,async()=>{
    await db.query("select public.update_timed_visit($1,$2,'2026-10-19','後日追記',2,null,null)",[group,visit]);
    const path=(await db.query("select * from public.reserve_visit_photo($1,$2,$3,'image/jpeg',12)",[group,visit,photo])).rows[0].object_path;
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[path,{size:12,mimetype:"image/jpeg"}]);await db.query("select public.finish_visit_photo($1,$2,$3)",[group,visit,photo]);
  });
  await asUser(bob,async()=>{assert.equal((await db.query("select note from public.visits where outing_id=$1",[plan])).rows[0].note,"後日追記");assert.equal((await db.query("select id from public.visit_photos where status='ready'")).rows.length,1);assert.equal((await db.query("select name from storage.objects")).rows.length,1);});
});
test("outsiders, anonymous and direct writes cannot cross album or completion boundaries",async()=>{
  await asUser(outsider,async()=>{assert.deepEqual((await db.query("select id from public.memories")).rows,[]);assert.deepEqual((await db.query("select name from storage.objects")).rows,[]);await fails(complete(false,5),"42501");await fails(complete(false,5,otherGroup),"42501");await fails(db.query("select public.update_memory($1,$2,'x','',2)",[group,memory]),"42501");await fails(record(null,null),"42501");});
  await asUser(alice,async()=>{await fails(db.query("update public.memories set note='direct'"),"42501");await fails(db.query("update public.outings set completed_at=null"),"42501");await fails(db.query("update public.visits set visited_time='11:00'"),"42501");});
  await asUser(null,async()=>{await fails(db.query("select id from public.memories"),"42501");await fails(complete(false,5),"42501");await fails(record(null,null),"42501");},"anon");
});
