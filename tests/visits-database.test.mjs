import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { after,before,test } from "node:test";
import { createStorageFixture } from "./storage-fixture.mjs";
const {PGlite}=await import(process.env.KOKOIKO_PGLITE_MODULE_URL??"@electric-sql/pglite");
let db;
const alice="00000000-0000-4000-8000-000000000001",bob="00000000-0000-4000-8000-000000000002",outsider="00000000-0000-4000-8000-000000000003";
const group="10000000-0000-4000-8000-000000000001",otherGroup="10000000-0000-4000-8000-000000000002";
const cafe="20000000-0000-4000-8000-000000000001",park="20000000-0000-4000-8000-000000000002",other="20000000-0000-4000-8000-000000000003";
const plan="30000000-0000-4000-8000-000000000001",visit="40000000-0000-4000-8000-000000000001",again="40000000-0000-4000-8000-000000000002",planned="40000000-0000-4000-8000-000000000003",limitVisit="40000000-0000-4000-8000-000000000004";
const photo="50000000-0000-4000-8000-000000000001",pending="50000000-0000-4000-8000-000000000002";
const fails=(promise,code)=>assert.rejects(promise,error=>error.code===code);
async function asUser(id,work,role="authenticated"){
  await db.exec(`set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
  try{return await work();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}
}
const record=(id,item=cafe,outing=null,rating=null)=>db.query("select public.record_visit($1,$2,$3,'2026-10-18','訪問メモ',$4,$5) as id",[group,item,outing,rating,id]);
const reserve=(id,visitId=visit,type="image/jpeg",size=12)=>db.query("select * from public.reserve_visit_photo($1,$2,$3,$4,$5)",[group,visitId,id,type,size]).then(result=>result.rows[0]);
const finish=id=>db.query("select public.finish_visit_photo($1,$2,$3)",[group,visit,id]);

before(async()=>{
  db=await PGlite.create();await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;insert into auth.users values('${alice}'),('${bob}'),('${outsider}');`);
  await createStorageFixture(db);
  for(const name of (await readdir(new URL("../supabase/migrations/",import.meta.url))).filter(name=>name.endsWith(".sql")).sort())await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  await asUser(alice,async()=>{await db.query("select public.set_my_display_name('A')");await db.query("select public.create_group('A',$1)",[group]);await db.query("select public.create_item($1,'カフェ','spot','',$2)",[group,cafe]);await db.query("select public.create_item($1,'公園','spot','',$2)",[group,park]);});
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[group,bob]);
  await asUser(outsider,async()=>{await db.query("select public.create_group('B',$1)",[otherGroup]);await db.query("select public.create_item($1,'外部','spot','',$2)",[otherGroup,other]);});
  await asUser(alice,()=>db.query("select public.save_outing($1,$2,0,'計画','2026-10-18','order','',$3,$4)",[group,plan,JSON.stringify([{item_id:cafe}]),[alice]]));
});
after(async()=>db?.close());

test("direct and planned visits keep separate revisits, snapshots and idempotent requests",async()=>{
  await asUser(alice,async()=>{assert.equal((await record(visit,cafe,null,4)).rows[0].id,visit);await record(visit,cafe,null,4);await record(again);await record(planned,cafe,plan);});
  assert.equal((await db.query("select count(*)::int as n from public.visits")).rows[0].n,3);
  await asUser(alice,()=>db.query("select public.update_item($1,$2,'新しい名前','','カフェ','')",[group,cafe]));
  assert.equal((await db.query("select item_title from public.visits where id=$1",[visit])).rows[0].item_title,"カフェ");
  await asUser(bob,()=>fails(record(visit),"23505"));
  await asUser(alice,()=>fails(record(limitVisit,park,plan),"42501"));
  await asUser(alice,()=>fails(record(limitVisit,other),"42501"));
});
test("shared note edits reject stale versions while personal ratings only change self",async()=>{
  await asUser(bob,()=>db.query("select public.update_visit($1,$2,'2026-10-19','変更',1)",[group,visit]));
  await asUser(alice,()=>fails(db.query("select public.update_visit($1,$2,'2026-10-20','上書き',1)",[group,visit]),"40001"));
  await asUser(bob,()=>db.query("select public.set_visit_rating($1,$2,2)",[group,visit]));
  const result=(await asUser(alice,()=>db.query("select * from public.get_visit_ratings($1,$2)",[group,visit]))).rows[0];
  assert.equal(Number(result.rating_count),2);assert.equal(Number(result.average_rating),3);assert.equal(result.my_rating,4);
  await asUser(alice,()=>db.query("select public.set_visit_rating($1,$2,null)",[group,visit]));
  await asUser(bob,async()=>{assert.deepEqual((await db.query("select value from public.visit_ratings")).rows,[{value:2}]);await fails(db.query("select public.set_visit_rating($1,$2,6)",[group,visit]),"22023");});
});
test("anonymous, outsiders and direct writes cannot bypass group or rating boundaries",async()=>{
  await asUser(outsider,async()=>{assert.deepEqual((await db.query("select id from public.visits")).rows,[]);await fails(record(limitVisit),"42501");await fails(db.query("select public.get_visit_ratings($1,$2)",[group,visit]),"42501");});
  await asUser(alice,()=>fails(db.query("update public.visits set note='x' where id=$1",[visit]),"42501"));
  await asUser(null,async()=>{await fails(db.query("select id from public.visits"),"42501");await fails(record(limitVisit),"42501");},"anon");
});
test("only the reserving member uploads, completion verifies real Storage metadata",async()=>{
  const reservation=await asUser(alice,()=>reserve(photo));
  await asUser(alice,()=>fails(finish(photo),"22023"));
  await asUser(bob,async()=>{assert.deepEqual((await db.query("select id from public.visit_photos")).rows,[]);await fails(db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[reservation.object_path,{size:12,mimetype:"image/jpeg"}]),"42501");});
  await asUser(alice,async()=>{await db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[reservation.object_path,{size:12,mimetype:"image/jpeg"}]);await finish(photo);await finish(photo);});
  await asUser(bob,async()=>{assert.equal((await db.query("select name from storage.objects")).rows.length,1);assert.equal((await db.query("select status from public.visit_photos")).rows[0].status,"ready");});
  await asUser(outsider,async()=>{assert.deepEqual((await db.query("select name from storage.objects")).rows,[]);await fails(reserve(pending),"42501");});
  await asUser(alice,()=>fails(db.query("update storage.objects set metadata='{}'"),"42501"));
  assert.equal((await db.query("select public from storage.buckets where id='visit-photos'")).rows[0].public,false);
});
test("cancel stops uploads before removing metadata, frees the slot and preserves ready photos",async()=>{
  await asUser(alice,()=>reserve(pending));
  const path=(await asUser(alice,()=>db.query("select public.begin_cancel_visit_photo($1,$2,$3) as path",[group,visit,pending]))).rows[0].path;
  await asUser(alice,async()=>{
    await fails(db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,'{}')",[path]),"42501");
    await fails(finish(pending),"42501");
    await db.query("select public.cancel_visit_photo($1,$2,$3)",[group,visit,pending]);
    const next=await reserve(pending);assert.equal(next.status,"pending");
    await fails(db.query("select public.begin_cancel_visit_photo($1,$2,$3)",[group,visit,photo]),"42501");
    assert.equal((await db.query("delete from storage.objects where name like '%.jpg'")).affectedRows,0);
  });
});
test("ten active reservations cap concurrent slots; size and MIME are validated",async()=>{
  await asUser(alice,()=>record(limitVisit));
  await asUser(alice,async()=>{
    for(let n=10;n<20;n++)await reserve(`50000000-0000-4000-8000-${String(n).padStart(12,"0")}`,limitVisit);
    await fails(reserve("50000000-0000-4000-8000-000000000020",limitVisit),"54000");
    await fails(reserve("50000000-0000-4000-8000-000000000021",visit,"image/svg+xml"),"22023");
    await fails(reserve("50000000-0000-4000-8000-000000000022",visit,"image/jpeg",10485761),"22023");
  });
});
test("wrong upload metadata stays unfinished and cancellation removes the object before freeing its slot",async()=>{
  const id="50000000-0000-4000-8000-000000000003",reserved=await asUser(alice,()=>reserve(id));
  await asUser(alice,async()=>{
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[reserved.object_path,{size:11,mimetype:"image/jpeg"}]);
    await fails(finish(id),"22023");
    await db.query("select public.begin_cancel_visit_photo($1,$2,$3)",[group,visit,id]);
    await fails(db.query("select public.cancel_visit_photo($1,$2,$3)",[group,visit,id]),"22023");
    assert.equal((await db.query("delete from storage.objects where name=$1",[reserved.object_path])).affectedRows,1);
    await db.query("select public.cancel_visit_photo($1,$2,$3)",[group,visit,id]);
  });
  assert.equal((await db.query("select count(*)::int as n from public.visit_photos where id=$1",[id])).rows[0].n,0);
});
