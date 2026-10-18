import assert from 'node:assert/strict';import {before,after,test} from 'node:test';import {fixture,ids} from './shared-life-fixture.mjs';
let db,as,memory;const {alice,bob,outsider,group,cafe,plan,visit,photo,photo2}=ids;
const fails=(p,code)=>assert.rejects(p,e=>e.code===code);
before(async()=>{({db,as}=await fixture());await as(alice,()=>db.query("select public.record_visit($1,$2,$3,'2026-10-18','',null,$4)",[group,cafe,plan,visit]));
  for(const [user,id] of [[alice,photo],[bob,photo2]])await as(user,async()=>{const {rows:[r]}=await db.query("select * from public.reserve_visit_photo($1,$2,$3,'image/jpeg',12)",[group,visit,id]);await db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[r.object_path,{size:12,mimetype:'image/jpeg'}]);await db.query('select public.finish_visit_photo($1,$2,$3)',[group,visit,id]);});
  memory=(await as(alice,()=>db.query('select public.set_outing_completed($1,$2,true,1) id',[group,plan]))).rows[0].id;
});after(async()=>db?.close());
test('shared photo order keeps physical slots unchanged and detects concurrent changes',async()=>{
  await as(bob,()=>db.query('select public.reorder_visit_photos($1,$2,$3,$4)',[group,visit,[photo2,photo],[photo,photo2]]));
  assert.deepEqual((await db.query('select id from public.visit_photos order by display_order')).rows.map(p=>p.id),[photo2,photo]);assert.equal((await db.query('select slot from public.visit_photos where id=$1',[photo])).rows[0].slot,1);
  await as(alice,()=>fails(db.query('select public.reorder_visit_photos($1,$2,$3,$4)',[group,visit,[photo,photo2],[photo,photo2]]),'40001'));await as(alice,()=>fails(db.query('select public.reorder_visit_photos($1,$2,$3,$4)',[group,visit,[photo],[photo2,photo]]),'22023'));
});
test('cover accepts only a ready album photo and access remains group scoped',async()=>{
  await as(bob,()=>db.query('select public.set_memory_cover($1,$2,$3,1)',[group,memory,photo2]));assert.equal((await db.query('select cover_photo_id from public.memories')).rows[0].cover_photo_id,photo2);
  await as(outsider,()=>fails(db.query('select public.set_memory_cover($1,$2,$3,2)',[group,memory,photo]),'42501'));
});
test('photo deletion denies other members, waits for Storage removal and clears album cover',async()=>{
  await as(alice,()=>fails(db.query('select public.begin_remove_photo($1,$2,$3)',[group,visit,photo2]),'42501'));
  const path=(await as(bob,()=>db.query('select public.begin_remove_photo($1,$2,$3) path',[group,visit,photo2]))).rows[0].path;
  await as(bob,()=>fails(db.query('select public.finish_remove_photo($1,$2,$3)',[group,visit,photo2]),'55000'));
  await as(bob,()=>db.query("delete from storage.objects where bucket_id='visit-photos' and name=$1",[path]));await as(bob,()=>db.query('select public.finish_remove_photo($1,$2,$3)',[group,visit,photo2]));await as(bob,()=>db.query('select public.finish_remove_photo($1,$2,$3)',[group,visit,photo2]));assert.equal((await db.query('select cover_photo_id from public.memories')).rows[0].cover_photo_id,null);
});
test('visit creator deletes the whole visit, freezes edits/uploads, verifies bytes gone and retries safely',async()=>{
  await as(bob,()=>fails(db.query('select public.begin_remove_visit($1,$2,1)',[group,visit]),'42501'));
  const rows=(await as(alice,()=>db.query('select * from public.begin_remove_visit($1,$2,1)',[group,visit]))).rows;assert.equal(rows.length,1);
  await as(alice,()=>fails(db.query("select public.update_visit($1,$2,'2026-10-18','変更',1)",[group,visit]),'55000'));
  await as(alice,()=>fails(db.query("select * from public.reserve_visit_photo($1,$2,$3,'image/png',12)",[group,visit,photo2]),'55000'));
  await as(alice,()=>fails(db.query('select public.finish_remove_visit($1,$2)',[group,visit]),'55000'));
  await as(alice,()=>db.query("delete from storage.objects where bucket_id='visit-photos' and name=$1",[rows[0].object_path]));await as(alice,()=>db.query('select public.finish_remove_visit($1,$2)',[group,visit]));await as(alice,()=>db.query('select public.finish_remove_visit($1,$2)',[group,visit]));assert.equal((await db.query('select count(*)::int n from public.visits')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.memories')).rows[0].n,1);
});
