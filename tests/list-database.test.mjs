import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createStorageFixture } from "./storage-fixture.mjs";

const { PGlite } = await import(process.env.KOKOIKO_PGLITE_MODULE_URL ?? "@electric-sql/pglite");
let db;
const alice="00000000-0000-4000-8000-000000000001", bob="00000000-0000-4000-8000-000000000002", outsider="00000000-0000-4000-8000-000000000003";
const groupA="10000000-0000-4000-8000-000000000001", groupB="10000000-0000-4000-8000-000000000002";
const itemA="20000000-0000-4000-8000-000000000001", itemB="20000000-0000-4000-8000-000000000002";
const listA="30000000-0000-4000-8000-000000000001", listB="30000000-0000-4000-8000-000000000002", listOther="30000000-0000-4000-8000-000000000003";
const fails=(promise,code)=>assert.rejects(promise,error=>error.code===code);
async function asUser(id,work,role="authenticated"){
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
  try{return await work();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}
}
const create=(group,name,id)=>db.query("select public.create_list($1,$2,$3) as id",[group,name,id]);
const set=(group,item,list,selected)=>db.query("select public.set_item_list($1,$2,$3,$4)",[group,item,list,selected]);
const get=(group,item,query="",page=1)=>db.query("select * from public.get_item_lists($1,$2,$3,$4)",[group,item,query,page]).then(result=>result.rows[0]);
const feed=(group,query="",kind=null,reaction=null,list=null,unclassified=false,page=1)=>db.query("select * from public.get_group_items($1,$2,$3,$4,$5,$6,$7)",[group,query,kind,reaction,list,unclassified,page]).then(result=>result.rows[0]);

before(async()=>{
  db=await PGlite.create();
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;insert into auth.users(id) values('${alice}'),('${bob}'),('${outsider}');`);
  await createStorageFixture(db);
  const migrations=(await readdir(new URL("../supabase/migrations/",import.meta.url))).filter(name=>name.endsWith(".sql")).sort();
  for(const name of migrations)await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  await asUser(alice,()=>db.query("select public.create_group('A',$1)",[groupA]));
  await asUser(bob,()=>db.query("select public.create_group('B',$1)",[groupB]));
  await asUser(alice,()=>db.query("select public.create_item($1,'Cafe 100%_','spot','memo',$2)",[groupA,itemA]));
  await asUser(bob,()=>db.query("select public.create_item($1,'Other','activity','',$2)",[groupB,itemB]));
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[groupA,bob]);
});
after(async()=>db?.close());

test("anonymous, unauthenticated and outsiders cannot access lists",async()=>{
  await asUser(null,async()=>{await fails(create(groupA,"x",listA),"42501");await fails(db.query("select id from public.lists"),"42501");},"anon");
  await asUser(null,()=>fails(create(groupA,"x",listA),"28000"));
  await asUser(outsider,async()=>{await fails(create(groupA,"x",listA),"42501");await fails(feed(groupA),"42501");});
});
test("members share management, idempotent creation and stale rename protection",async()=>{
  await asUser(alice,()=>create(groupA,"　カフェ　",listA));
  await asUser(bob,()=>create(groupA,"カフェ",listA));
  await asUser(bob,()=>fails(create(groupA,"違う",listA),"23505"));
  await asUser(bob,()=>db.query("select public.rename_list($1,$2,$3,$4)",[groupA,listA,"旅行","カフェ"]));
  await asUser(alice,()=>fails(db.query("select public.rename_list($1,$2,$3,$4)",[groupA,listA,"旧画面","カフェ"]),"40001"));
  await asUser(bob,()=>create(groupA,"別リスト",listB));
  await asUser(bob,()=>create(groupB,"他グループ",listOther));
  assert.equal((await db.query("select count(*)::int as n from public.lists")).rows[0].n,3);
});
test("column grants and composite keys prohibit actor spoofing and cross-group links",async()=>{
  await asUser(alice,async()=>{
    await fails(db.query("select created_by from public.lists"),"42501");
    await fails(db.query("update public.lists set group_id=$1 where id=$2",[groupB,listA]),"42501");
    await fails(db.query("insert into public.lists(id,group_id,name,created_by) values(gen_random_uuid(),$1,'x',$2)",[groupA,bob]),"42501");
    await fails(db.query("insert into public.lists(id,group_id,name) values(gen_random_uuid(),$1,'　')",[groupA]),"23514");
    await fails(db.query("insert into public.item_list_memberships(item_id,list_id,group_id) values($1,$2,$3)",[itemB,listA,groupA]),"23503");
    await fails(set(groupA,itemB,listA,true),"42501");
    await fails(set(groupA,itemA,listOther,true),"42501");
  });
});
test("candidate can join several lists; desired-state retries preserve other links",async()=>{
  await asUser(bob,async()=>{await set(groupA,itemA,listA,true);await set(groupA,itemA,listA,true);await set(groupA,itemA,listB,true);});
  let result=await asUser(alice,()=>get(groupA,itemA));
  assert.equal(result.total_count,2);assert.equal(result.lists.filter(row=>row.is_selected).length,2);
  await asUser(alice,async()=>{await set(groupA,itemA,listA,false);await set(groupA,itemA,listA,false);});
  result=await asUser(bob,()=>get(groupA,itemA,"別"));
  assert.deepEqual(result.lists.map(row=>[row.name,row.is_selected]),[["別リスト",true]]);
  assert.equal((await db.query("select count(*)::int as n from public.item_list_memberships")).rows[0].n,1);
});
test("list search and candidate filters include literal punctuation, own reaction, and unclassified",async()=>{
  await asUser(alice,()=>db.query("select public.rename_list($1,$2,$3,$4)",[groupA,listB,"Cafe 100%_","別リスト"]));
  assert.equal((await asUser(alice,()=>get(groupA,itemA,"100%_"))).total_count,1);
  assert.equal((await asUser(alice,()=>feed(groupA,"100%_","spot",null,listB))).total_count,1);
  assert.equal((await asUser(alice,()=>feed(groupA,"Cafe",null,null,null,true))).total_count,0);
  assert.equal((await asUser(alice,()=>feed(groupA,"",null,"unreacted",listB))).total_count,1);
  assert.equal((await asUser(alice,()=>feed(groupA,"",null,"want_to_go",listB))).total_count,0);
  await asUser(bob,()=>fails(feed(groupB,"",null,null,listB),"42501"));
});
test("deleting only a list keeps the candidate and other classifications",async()=>{
  await asUser(alice,()=>set(groupA,itemA,listA,true));
  await asUser(alice,()=>db.query("select public.create_item_comment($1,$2,'残すコメント',$3)",[groupA,itemA,"40000000-0000-4000-8000-000000000001"]));
  await asUser(bob,()=>db.query("select public.set_item_reaction($1,$2,'want_to_go')",[groupA,itemA]));
  await asUser(bob,()=>fails(db.query("select public.delete_list($1,$2,$3)",[groupA,listA,"カフェ"]),"40001"));
  await asUser(bob,()=>db.query("select public.delete_list($1,$2,$3)",[groupA,listA,"旅行"]));
  await asUser(alice,()=>db.query("select public.delete_list($1,$2,$3)",[groupA,listA,"旅行"]));
  assert.deepEqual((await db.query("select id from public.items where id=$1",[itemA])).rows,[{id:itemA}]);
  assert.deepEqual((await db.query("select list_id from public.item_list_memberships where item_id=$1",[itemA])).rows,[{list_id:listB}]);
  assert.equal((await db.query("select count(*)::int as n from public.item_comments where item_id=$1",[itemA])).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int as n from public.item_reactions where item_id=$1",[itemA])).rows[0].n,1);
  await asUser(outsider,()=>fails(db.query("select public.delete_list($1,$2,$3)",[groupA,listA,"旅行"]),"42501"));
});

test("empty pages keep total counts and leaving a group immediately removes access",async()=>{
  const more=[];
  for(let n=10;n<34;n++)more.push(`('30000000-0000-4000-8000-${String(n).padStart(12,"0")}','${groupA}','番号${n}')`);
  await asUser(alice,()=>db.exec(`insert into public.lists(id,group_id,name) values ${more.join(",")}`));
  const page=await asUser(alice,()=>get(groupA,itemA,"番号",2));
  assert.equal(page.total_count,24);assert.equal(page.lists.length,4);
  const empty=await asUser(alice,()=>get(groupA,itemA,"番号",3));
  assert.equal(empty.total_count,24);assert.deepEqual(empty.lists,[]);
  await db.query("delete from public.group_members where group_id=$1 and user_id=$2",[groupA,bob]);
  await asUser(bob,async()=>{
    assert.deepEqual((await db.query("select id from public.lists where group_id=$1",[groupA])).rows,[]);
    await fails(set(groupA,itemA,listB,true),"42501");
    await fails(feed(groupA),"42501");
  });
});
