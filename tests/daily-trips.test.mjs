import assert from 'node:assert/strict';import {before,after,test} from 'node:test';import {fixture,ids} from './shared-life-fixture.mjs';
let db,as;const {alice,bob,outsider,group,cafe,visit}=ids;
const trip='30000000-0000-4000-8000-000000000010';const stops=[1,2,3].map(n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
const stop=(id,item=cafe)=>({id,item_id:item,planned_time:'09:15',period:'morning'});
const days=[{mode:'exact',participants:[alice,bob],items:[stop(stops[0]),stop(stops[1])]},{mode:'period',participants:[bob],items:[]},{mode:'order',participants:[alice],items:[stop(stops[2])]}];
const save=(revision=0,value=days,start='2026-10-20',end='2026-10-22',removed=[])=>db.query('select public.save_trip($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) revision',[group,trip,revision,'3日間の旅',start,end,'メモ',JSON.stringify(value),[alice,bob],removed]);
const fails=(p,code)=>assert.rejects(p,e=>e.code===code);
before(async()=>({db,as}=await fixture()));after(async()=>db?.close());
test('daily trip stores repeated stops, distinct modes and people; a create retry is exact and idempotent',async()=>{
  const result=await as(alice,()=>save());assert.equal(result.rows[0].revision,1);await as(alice,()=>save());
  assert.equal((await db.query('select count(*)::int n from public.outing_items where outing_id=$1',[trip])).rows[0].n,3);
  const actual=(await db.query('select day_index,mode,participants from public.outing_days where outing_id=$1 order by day_index',[trip])).rows;assert.deepEqual(actual.map(d=>d.mode),['exact','period','order']);assert.deepEqual(actual[1].participants,[bob]);
  const changed=structuredClone(days);changed[0].items[0].planned_time='10:00';await as(alice,()=>fails(save(0,changed),'40001'));
});
test('date shifts retain day numbers and stop identity; actual visits do not shift',async()=>{
  await as(alice,()=>db.query("select public.record_stop_visit($1,$2,$3,$4,'2026-10-20','実際の記録',4,$5,null,null)",[group,cafe,trip,stops[1],visit]));
  await as(bob,()=>save(1,days,'2026-11-01','2026-11-03'));
  const actual=(await db.query('select visited_on::text,outing_stop_id from public.visits where id=$1',[visit])).rows[0];assert.deepEqual(actual,{visited_on:'2026-10-20',outing_stop_id:stops[1]});
  await as(bob,()=>fails(db.query("select public.save_outing($1,$2,2,'old','2026-11-01','order','',$3,$4)",[group,trip,JSON.stringify([{item_id:cafe}]),[bob]]),'55000'));
});
test('shortening never silently drops destinations; moving or explicitly removing permits it',async()=>{
  await as(alice,()=>fails(save(2,days.slice(0,2),'2026-11-01','2026-11-02'),'22023'));
  const shortened=structuredClone(days.slice(0,2));shortened[1].items.push(stop(stops[2]));await as(alice,()=>save(2,shortened,'2026-11-01','2026-11-02'));await as(alice,()=>save(2,shortened,'2026-11-01','2026-11-02'));
  assert.equal((await db.query('select day_index from public.outing_items where id=$1',[stops[2]])).rows[0].day_index,1);
});
test('new archived stops, foreign participants, missing times and duplicate slot IDs fail atomically',async()=>{
  await as(alice,()=>db.query('select public.set_item_attributes($1,$2,0,0,true,false)',[group,cafe]));
  const valid=structuredClone(days.slice(0,2));valid[1].items.push(stop(stops[2]));
  const archived=structuredClone(valid);archived[0].items.push(stop('70000000-0000-4000-8000-000000000004'));await as(alice,()=>fails(save(3,archived,'2026-11-01','2026-11-02'),'42501'));
  const foreign=structuredClone(valid);foreign[1].participants=[outsider];await as(alice,()=>fails(save(3,foreign,'2026-11-01','2026-11-02'),'42501'));
  const badTime=structuredClone(valid);badTime[0].items[0].planned_time=null;await as(alice,()=>fails(save(3,badTime,'2026-11-01','2026-11-02'),'22023'));
  const duplicate=structuredClone(valid);duplicate[0].items[1].id=stops[0];await as(alice,()=>fails(save(3,duplicate,'2026-11-01','2026-11-02'),'22023'));
  await as(outsider,()=>fails(save(3,valid,'2026-11-01','2026-11-02'),'42501'));
  // An already planned archived stop stays usable through an edit.
  await as(bob,()=>save(3,valid,'2026-11-01','2026-11-02'));
});
test('cancel/resume is shared and CAS guarded; data and album remain and cancellation blocks completion',async()=>{
  await as(bob,()=>db.query('select public.set_outing_cancelled($1,$2,true,4)',[group,trip]));await as(bob,()=>db.query('select public.set_outing_cancelled($1,$2,true,4)',[group,trip]));
  await as(alice,()=>fails(db.query('select public.set_outing_completed($1,$2,true,5)',[group,trip]),'22023'));await as(alice,()=>fails(db.query('select public.set_outing_cancelled($1,$2,false,4)',[group,trip]),'40001'));
  await as(alice,()=>db.query('select public.set_outing_cancelled($1,$2,false,5)',[group,trip]));
  const memory=(await as(alice,()=>db.query('select public.set_outing_completed($1,$2,true,6) id',[group,trip]))).rows[0].id;
  assert.deepEqual((await db.query('select memory_date::text,memory_end_date::text from public.memories where id=$1',[memory])).rows[0],{memory_date:'2026-11-01',memory_end_date:'2026-11-02'});
  assert.equal((await db.query('select count(*)::int n from public.visits where id=$1',[visit])).rows[0].n,1);
  await as(alice,()=>db.query('select public.set_outing_completed($1,$2,false,7)',[group,trip]));await as(bob,()=>db.query('select public.set_outing_cancelled($1,$2,true,8)',[group,trip]));assert.equal((await db.query('select count(*)::int n from public.memories where outing_id=$1',[trip])).rows[0].n,1);
});
