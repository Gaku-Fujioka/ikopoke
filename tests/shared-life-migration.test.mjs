import assert from 'node:assert/strict';import {test} from 'node:test';import {readdir,readFile} from 'node:fs/promises';import {fixture,ids} from './shared-life-fixture.mjs';
test('existing completed single-day plans, visits, photos and album covers survive daily-trip and lifecycle migrations',async()=>{
 const {db,as}=await fixture({before:'daily_trip_plans'});const {alice,group,cafe,plan,visit,photo}=ids;
 try{
  await as(alice,()=>db.query("select public.record_timed_visit($1,$2,$3,'2026-10-18','思い出',5,$4,'10:00',null)",[group,cafe,plan,visit]));
  const reservation=(await as(alice,()=>db.query("select * from public.reserve_visit_photo($1,$2,$3,'image/jpeg',12)",[group,visit,photo]))).rows[0];
  await as(alice,()=>db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[reservation.object_path,{size:12,mimetype:'image/jpeg'}]));await as(alice,()=>db.query('select public.finish_visit_photo($1,$2,$3)',[group,visit,photo]));
  const memory=(await as(alice,()=>db.query('select public.set_outing_completed($1,$2,true,1) id',[group,plan]))).rows[0].id;await as(alice,()=>db.query('select public.set_memory_cover($1,$2,$3,1)',[group,memory,photo]));const completed=(await db.query('select completed_at::text from public.outings where id=$1',[plan])).rows[0].completed_at;
  const migrations=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort();const start=migrations.findIndex(n=>n.includes('daily_trip_plans'));for(const name of migrations.slice(start))await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
  const outing=(await db.query('select outing_date::text,end_date::text,completed_at::text,revision from public.outings where id=$1',[plan])).rows[0];assert.deepEqual(outing,{outing_date:'2026-10-18',end_date:'2026-10-18',completed_at:completed,revision:2});
  const v=(await db.query('select visited_on::text,visited_time::text,note,outing_stop_id from public.visits where id=$1',[visit])).rows[0];assert.equal(v.visited_on,'2026-10-18');assert.equal(v.visited_time,'10:00:00');assert.equal(v.note,'思い出');assert.equal(v.outing_stop_id,(await db.query('select id from public.outing_items where outing_id=$1',[plan])).rows[0].id);
  assert.equal((await db.query('select cover_photo_id from public.memories where id=$1',[memory])).rows[0].cover_photo_id,photo);assert.equal((await as(alice,()=>db.query('select name from storage.objects'))).rows[0].name,reservation.object_path);
  assert.equal((await db.query('select cardinality(participants) n from public.outing_days where outing_id=$1',[plan])).rows[0].n,2);
 }finally{await db.close();}
});
