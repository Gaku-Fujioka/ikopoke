import {createStorageFixture} from "./storage-fixture.mjs";
import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {registerHooks} from "node:module";
import {after,before,test} from "node:test";
import {createClient} from "@supabase/supabase-js";
registerHooks({resolve(specifier,context,next){return specifier==="@/lib/items/search"?{url:new URL("../lib/items/search.ts",import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
const {listItems}=await import("../lib/items/repository.ts");
const {PGlite}=await import(process.env.KOKOIKO_PGLITE_MODULE_URL??"@electric-sql/pglite");
let db;
const alice="00000000-0000-4000-8000-000000000001",bob="00000000-0000-4000-8000-000000000002",outsider="00000000-0000-4000-8000-000000000003";
const groupA="10000000-0000-4000-8000-000000000001",groupB="10000000-0000-4000-8000-000000000002";
const itemA="20000000-0000-4000-8000-000000000001",itemB="20000000-0000-4000-8000-000000000002",itemC="20000000-0000-4000-8000-000000000003";
const commentA="30000000-0000-4000-8000-000000000001";
before(async()=>{
  db=await PGlite.create();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    insert into auth.users(id) values('${alice}'),('${bob}'),('${outsider}');`);
  await createStorageFixture(db);
  for(const name of (await readdir(new URL("../supabase/migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort())await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  await asUser(alice,()=>db.query("select public.create_group('A',$1)",[groupA]));
  await asUser(bob,()=>db.query("select public.create_group('B',$1)",[groupB]));
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[groupA,bob]);
  for(const [actor,group,id,title,kind] of [[alice,groupA,itemA,"カフェ","spot"],[bob,groupB,itemB,"別グループ","spot"],[alice,groupA,itemC,"散歩","activity"]])
    await asUser(actor,()=>db.query("select public.create_item($1,$2,$3,'',$4)",[group,title,kind,id]));
});
after(async()=>{await db?.close();});
async function asUser(user,work,role="authenticated"){
  await db.exec(`set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??""]);
  try{return await work();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','','false')");}
}
const fails=(promise,code)=>assert.rejects(promise,error=>error.code===code);
const edit=(title="カフェ改",memo="メモ",expectedTitle="カフェ",expectedMemo="",group=groupA,item=itemA)=>db.query("select public.update_item($1,$2,$3,$4,$5,$6)",[group,item,title,memo,expectedTitle,expectedMemo]);
const post=(body=" コメント ",id=commentA,group=groupA,item=itemA)=>db.query("select public.create_item_comment($1,$2,$3,$4)",[group,item,body,id]);
const comments=(group=groupA,item=itemA,page=1)=>db.query("select * from public.get_item_comments($1,$2,$3)",[group,item,page]);

test("anonymous users cannot use any new view, table or RPC",async()=>{
  await asUser(null,async()=>{
    for(const work of [()=>edit(),()=>post(),()=>comments(),()=>db.query("select id from public.shared_item_feed"),()=>db.query("select id,body from public.item_comments")])await fails(work(),"42501");
  },"anon");
});
test("missing identities, non-members and mismatched item/group pairs are rejected",async()=>{
  for(const actor of [null,outsider])await asUser(actor,async()=>{
    for(const work of [()=>edit(),()=>post(),()=>comments()])await fails(work(),actor===null?"28000":"42501");
  });
  await asUser(bob,async()=>{
    await fails(edit("x","","カフェ","",groupB,itemA),"42501");
    await fails(post("x",commentA,groupB,itemA),"42501");await fails(comments(groupB,itemA),"42501");
  });
});
test("another member can edit names and memos while group, kind and creator stay intact",async()=>{
  const before=(await db.query("select * from public.items where id=$1",[itemA])).rows[0];
  await asUser(bob,()=>edit("　カフェ改 ","　メモ "));
  const after=(await db.query("select * from public.items where id=$1",[itemA])).rows[0];
  assert.deepEqual(after,{...before,title:"カフェ改",memo:"メモ"});
  await asUser(bob,()=>fails(db.query("update public.items set kind='activity' where id=$1",[itemA]),"42501"));
});
test("stale editors cannot overwrite changes, but retrying the same completed save is safe",async()=>{
  await asUser(alice,()=>fails(edit("古い画面の変更","別のメモ"),"40001"));
  await asUser(bob,()=>edit());
  assert.equal((await db.query("select title from public.items where id=$1",[itemA])).rows[0].title,"カフェ改");
  await asUser(alice,()=>edit("カフェ改2","","カフェ改","メモ"));
  await asUser(bob,()=>fails(edit(),"40001"));
});
test("edit boundaries and expected snapshots are enforced in the database",async()=>{
  for(const [title,memo,expectedTitle,expectedMemo] of [[null,"","カフェ改2",""],["　\t\uFEFF","","カフェ改2",""],["😀".repeat(101),"","カフェ改2",""],["valid","🌸".repeat(2001),"カフェ改2",""],["valid","",null,""],["valid","","カフェ改2",null]])
    await asUser(alice,()=>fails(edit(title,memo,expectedTitle,expectedMemo),"22023"));
  await asUser(alice,()=>edit("😀".repeat(100),"🌸".repeat(2000),"カフェ改2",""));
  await asUser(alice,()=>edit("カフェ","","😀".repeat(100),"🌸".repeat(2000)));
});
test("the feed applies caller RLS and never treats another user's reaction as their own",async()=>{
  await asUser(alice,()=>db.query("select public.set_item_reaction($1,$2,'want_to_go')",[groupA,itemA]));
  await asUser(bob,()=>db.query("select public.set_item_reaction($1,$2,'not_now')",[groupA,itemC]));
  const own=await asUser(alice,()=>db.query("select id,my_reaction from public.shared_item_feed order by id"));
  assert.deepEqual(own.rows,[{id:itemA,my_reaction:"want_to_go"},{id:itemC,my_reaction:null}]);
  const other=await asUser(bob,()=>db.query("select id,my_reaction from public.shared_item_feed where group_id=$1 order by id",[groupA]));
  assert.deepEqual(other.rows,[{id:itemA,my_reaction:null},{id:itemC,my_reaction:"not_now"}]);
  assert.deepEqual((await asUser(outsider,()=>db.query("select * from public.shared_item_feed"))).rows,[]);
  await asUser(alice,()=>fails(db.query("update public.shared_item_feed set title='x' where id=$1",[itemA]),"42501"));
});
test("actual SDK combines name, kind, reaction and pagination before computing result counts",async()=>{
  // Synthetic transport, real SDK URL generation and PostgreSQL filters/RLS.
  const client=createClient("https://tools-test.invalid","synthetic-test-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
      const request=new Request(input,init),url=new URL(request.url),args=await request.json();
      assert.ok(url.pathname.endsWith("/rpc/browse_items"));

      const keys=["p_group_id","p_query","p_kind","p_reaction","p_list_id","p_unclassified","p_archived","p_visited","p_priority","p_sort","p_page"];
      const result=await db.query("select * from public.browse_items($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",keys.map(k=>args[k]));
      return new Response(JSON.stringify(result.rows.map(r=>({...r,total_count:Number(r.total_count)}))),{status:200,headers:{"Content-Type":"application/json"}});
  }}});
  try{
    for(const [query,filters,ids] of [["フェ",{kind:"spot",reaction:"want_to_go"},[itemA]],["",{reaction:"unreacted"},[itemC]],["",{kind:"activity",reaction:"not_now"},[]]]){
      const result=await asUser(alice,()=>listItems(client,groupA,1,query,filters));assert.deepEqual(result.items.map(row=>row.id),ids);assert.equal(result.total,ids.length);
    }
    assert.deepEqual(await asUser(bob,()=>listItems(client,groupA,1,"",{reaction:"not_now"})).then(value=>value.items.map(row=>row.id)),[itemC]);
    assert.deepEqual(await asUser(alice,()=>listItems(client,groupA,2,"",{reaction:"want_to_go"})),{items:[],total:1});
  }finally{client.auth.stopAutoRefresh();}
});
test("comment creation trims text, derives its author and retries without duplicates",async()=>{
  await asUser(alice,()=>post());await asUser(alice,()=>post());
  const rows=(await db.query("select body,created_by from public.item_comments where id=$1",[commentA])).rows;
  assert.deepEqual(rows,[{body:"コメント",created_by:alice}]);
  await asUser(alice,()=>fails(post("違う内容"),"23505"));await asUser(bob,()=>fails(post(),"23505"));
  await asUser(bob,()=>fails(post("コメント",commentA,groupB,itemB),"23505"));
});
test("comment validation, direct writes and raw author access cannot bypass the RPC",async()=>{
  for(const body of [null,"", "　\t\uFEFF", "🌸".repeat(2001)])await asUser(alice,()=>fails(post(body,"30000000-0000-4000-8000-000000000002"),"22023"));
  await asUser(alice,()=>fails(post("x",null),"22023"));
  await asUser(bob,async()=>{
    await fails(db.query("select created_by from public.item_comments"),"42501");
    await fails(db.query("insert into public.item_comments(id,item_id,body,created_by) values(gen_random_uuid(),$1,'x',$2)",[itemA,alice]),"42501");
    await fails(db.query("update public.item_comments set body='x' where id=$1",[commentA]),"42501");
    await fails(db.query("delete from public.item_comments where id=$1",[commentA]),"42501");
  });
  assert.deepEqual((await asUser(outsider,()=>db.query("select id,body from public.item_comments"))).rows,[]);
});
test("comment pages are bounded, deterministic and keep total counts on empty pages",async()=>{
  for(let n=2;n<=23;n++)await asUser(bob,()=>post(n===23?"🌸".repeat(2000):`コメント${n}`,`30000000-0000-4000-8000-${String(n).padStart(12,"0")}`));
  const first=(await asUser(alice,()=>comments())).rows[0],second=(await asUser(alice,()=>comments(groupA,itemA,2))).rows[0];
  assert.equal(Number(first.total_count),23);assert.equal(first.comments.length,20);assert.equal(second.comments.length,3);
  assert.equal(new Set([...first.comments,...second.comments].map(row=>row.id)).size,23);
  assert.equal([...first.comments,...second.comments].filter(row=>row.is_mine).length,1);
  assert.deepEqual(Object.keys(first.comments[0]).sort(),["body","created_at","id","is_mine"]);
  assert.deepEqual((await asUser(alice,()=>comments(groupA,itemA,99))).rows[0].comments,[]);
  for(const page of [0,-1,1000000,null])await asUser(alice,()=>fails(comments(groupA,itemA,page),"22023"));
  assert.equal(Number((await asUser(bob,()=>comments(groupB,itemB))).rows[0].total_count),0);
});
test("membership removal denies edits, comments, retries and feed reads",async()=>{
  await db.query("delete from public.group_members where group_id=$1 and user_id=$2",[groupA,alice]);
  await asUser(alice,async()=>{
    await fails(edit("カフェ","","カフェ",""),"42501");await fails(post(),"42501");await fails(comments(),"42501");
    assert.deepEqual((await db.query("select id from public.shared_item_feed")).rows,[]);
    assert.deepEqual((await db.query("select id,body from public.item_comments")).rows,[]);
  });
});
