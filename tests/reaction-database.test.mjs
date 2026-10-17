import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

const {PGlite}=await import(process.env.KOKOIKO_PGLITE_MODULE_URL??"@electric-sql/pglite");
let db;
const alice="00000000-0000-4000-8000-000000000001",bob="00000000-0000-4000-8000-000000000002",charlie="00000000-0000-4000-8000-000000000003";
const groupA="10000000-0000-4000-8000-000000000001",groupB="10000000-0000-4000-8000-000000000002";
const itemA="20000000-0000-4000-8000-000000000001",itemB="20000000-0000-4000-8000-000000000002";
before(async()=>{
  db=await PGlite.create();
  // Real PostgreSQL roles, functions and RLS; JWT verification is outside this fixture.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    insert into auth.users(id) values('${alice}'),('${bob}'),('${charlie}');
  `);
  for(const name of ["20261017091513_create_groups.sql","20261017112451_create_items.sql","20261017153040_create_item_reactions.sql"]){
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  }
  await asUser(alice,()=>db.query("select public.create_group('A',$1)",[groupA]));
  await asUser(bob,()=>db.query("select public.create_group('B',$1)",[groupB]));
  await asUser(alice,()=>db.query("select public.create_item($1,'カフェ','spot','',$2)",[groupA,itemA]));
  await asUser(bob,()=>db.query("select public.create_item($1,'散歩','activity','',$2)",[groupB,itemB]));
  // Fixture membership: invitation behavior is tested separately with its real RPC.
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[groupA,bob]);
});
after(async()=>{await db?.close();});
async function asUser(user,work,role="authenticated"){
  await db.exec(`set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??""]);
  try{return await work();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','','false')");}
}
const fails=(promise,code)=>assert.rejects(promise,error=>error.code===code);
const set=(value,group=groupA,item=itemA)=>db.query("select public.set_item_reaction($1,$2,$3)",[group,item,value]);
async function summary(group=groupA,item=itemA){
  const row=(await db.query("select * from public.get_item_reactions($1,$2)",[group,item])).rows[0];
  return {...row,want_count:Number(row.want_count),not_now_count:Number(row.not_now_count)};
}

test("anonymous users cannot read raw reactions or execute either RPC",async()=>{
  await asUser(null,async()=>{
    await fails(db.query("select * from public.item_reactions"),"42501");
    await fails(summary(),"42501");await fails(set("want_to_go"),"42501");
  },"anon");
});

test("an authenticated role without identity cannot read totals or save",async()=>{
  await asUser(null,async()=>{await fails(summary(),"28000");await fails(set("want_to_go"),"28000");});
});

test("non-members and mismatched candidate/group IDs are rejected",async()=>{
  await asUser(charlie,async()=>{await fails(summary(),"42501");await fails(set("want_to_go"),"42501");});
  await asUser(bob,async()=>{
    await fails(summary(groupB,itemA),"42501");await fails(set("want_to_go",groupB,itemA),"42501");
    await fails(summary(groupA,itemB),"42501");await fails(set(null,groupA,itemB),"42501");
  });
  await asUser(alice,()=>fails(set("want_to_go",null,itemA),"42501"));
  await asUser(alice,()=>fails(summary(groupA,null),"42501"));
});

test("no reaction is distinct from the negative choice and totals start at zero",async()=>{
  assert.deepEqual(await asUser(alice,()=>summary()),{want_count:0,not_now_count:0,my_reaction:null});
});

test("saving and replaying the same positive choice leaves one reaction",async()=>{
  for(let n=0;n<3;n++)await asUser(alice,()=>set("want_to_go"));
  assert.deepEqual(await asUser(alice,()=>summary()),{want_count:1,not_now_count:0,my_reaction:"want_to_go"});
  assert.equal((await db.query("select count(*)::int as n from public.item_reactions")).rows[0].n,1);
});

test("changing to the other choice moves the count instead of adding a second reaction",async()=>{
  await asUser(alice,()=>set("not_now"));
  assert.deepEqual(await asUser(alice,()=>summary()),{want_count:0,not_now_count:1,my_reaction:"not_now"});
});

test("members see combined totals and their own value without other members' raw identities",async()=>{
  await asUser(bob,()=>set("want_to_go"));
  assert.deepEqual(await asUser(bob,()=>summary()),{want_count:1,not_now_count:1,my_reaction:"want_to_go"});
  await asUser(alice,async()=>{
    assert.deepEqual((await db.query("select user_id,value from public.item_reactions where item_id=$1",[itemA])).rows,[{user_id:alice,value:"not_now"}]);
    assert.deepEqual((await db.query("select value from public.item_reactions where user_id=$1",[bob])).rows,[]);
  });
});

test("cancelling and replaying a cancellation removes only the current actor's reaction",async()=>{
  await asUser(alice,()=>set(null));await asUser(alice,()=>set(null));
  assert.deepEqual(await asUser(alice,()=>summary()),{want_count:1,not_now_count:0,my_reaction:null});
  assert.equal((await db.query("select value from public.item_reactions where user_id=$1",[bob])).rows[0].value,"want_to_go");
});

test("direct insert, editing another user and deleting another reaction cannot bypass RPC",async()=>{
  await asUser(alice,async()=>{
    await fails(db.query("insert into public.item_reactions(item_id,user_id,value) values($1,$2,'not_now')",[itemA,bob]),"42501");
    await fails(db.query("update public.item_reactions set value='not_now' where user_id=$1",[bob]),"42501");
    await fails(db.query("delete from public.item_reactions where user_id=$1",[bob]),"42501");
  });
});

test("invalid values never replace a saved choice",async()=>{
  await asUser(bob,()=>fails(set("anything-else"),"22023"));
  assert.equal((await asUser(bob,()=>summary())).my_reaction,"want_to_go");
});

test("totals include every row rather than silently truncating at a REST row limit",async()=>{
  await db.exec(`
    insert into auth.users(id) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,1001) n;
    insert into public.group_members(group_id,user_id)
      select '${groupB}',id from auth.users where id::text like '30000000-%';
    insert into public.item_reactions(item_id,user_id,value)
      select '${itemB}',id,'want_to_go' from auth.users where id::text like '30000000-%';
  `);
  assert.deepEqual(await asUser(bob,()=>summary(groupB,itemB)),{want_count:1001,not_now_count:0,my_reaction:null});
});

test("removing membership denies reading and changing even one's previously saved reaction",async()=>{
  await db.query("delete from public.group_members where group_id=$1 and user_id=$2",[groupA,bob]);
  await asUser(bob,async()=>{
    await fails(summary(),"42501");await fails(set(null),"42501");
    assert.deepEqual((await db.query("select item_id from public.item_reactions where item_id=$1",[itemA])).rows,[]);
  });
});
