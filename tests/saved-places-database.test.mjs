import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, ids } from './shared-life-fixture.mjs';
const request='70000000-0000-4000-8000-000000000001',list='80000000-0000-4000-8000-000000000001';
test('place save is atomic, deduplicated per group, and anonymous/foreign access is denied',async()=>{
 const {db,as}=await fixture();const {alice,bob,outsider,group,otherGroup}=ids;
 try{
  await as(alice,()=>db.query("select public.create_list($1,'カフェ',$2)",[group,list]));
  const save=(actor,g=group,place='ChIJ_shared',req=request,lists=[list])=>as(actor,()=>db.query("select * from public.save_place_item($1,$2,'週末のカフェ',$3,$4)",[g,place,lists,req]));
  const first=(await save(alice)).rows[0];assert.deepEqual(first,{item_id:request,reused:false,archived:false});
  assert.equal((await save(bob,group,'ChIJ_shared','70000000-0000-4000-8000-000000000002')).rows[0].item_id,request);
  assert.equal((await save(alice)).rows[0].reused,true);
  assert.equal((await db.query('select count(*)::int n from public.item_list_memberships where item_id=$1',[request])).rows[0].n,1);
  await assert.rejects(save(outsider),e=>e.code==='42501');
  await assert.rejects(as(null,()=>db.query('select * from public.save_place_item($1,$2,$3,$4,$5)',[group,'x','x',[],request]),'anon'),e=>e.code==='42501');
  assert.equal((await as(outsider,()=>db.query('select * from public.item_places'))).rows.length,0);
  await assert.rejects(as(alice,()=>db.query('insert into public.item_places values($1,$2,$3)',[ids.park,group,'fake'])),e=>e.code==='42501');
  const otherRequest='70000000-0000-4000-8000-000000000003';
  await assert.rejects(save(alice,group,'ChIJ_rollback',otherRequest,['80000000-0000-4000-8000-000000000099']));
  assert.equal((await db.query('select count(*)::int n from public.items where id=$1',[otherRequest])).rows[0].n,0);
  await save(outsider,otherGroup,'ChIJ_shared',otherRequest,[]);
  await db.query('update public.items set archived_at=now() where id=$1',[request]);
  assert.equal((await save(bob,group,'ChIJ_shared','70000000-0000-4000-8000-000000000004')).rows[0].archived,true);
  assert.ok((await db.query('select archived_at from public.items where id=$1',[request])).rows[0].archived_at);
 }finally{await db.close();}
});
test('existing candidates attach/change/unlink with conflict checks and preserved records',async()=>{
 const {db,as}=await fixture();const {alice,group,cafe,park,outsider,otherGroup}=ids;
 const set=(g,item,place,expected=null,user=alice)=>as(user,()=>db.query('select public.set_item_place($1,$2,$3,$4)',[g,item,place,expected]));
 try{
  await set(group,cafe,'ChIJ_one');
  await assert.rejects(set(group,cafe,'ChIJ_two'),e=>e.code==='40001');
  await assert.rejects(set(group,park,'ChIJ_one'),e=>e.code==='23505');
  await assert.rejects(set(otherGroup,cafe,'ChIJ_two',null,outsider),e=>e.code==='42501');
  await assert.rejects(set(group,cafe,'https://bad.example','ChIJ_one'),e=>e.code==='22023');
  await set(group,cafe,'ChIJ_two','ChIJ_one');await set(group,cafe,null,'ChIJ_two');
  assert.equal((await db.query('select count(*)::int n from public.item_places')).rows[0].n,0);
  assert.equal((await db.query('select title,memo from public.items where id=$1',[cafe])).rows[0].memo,'メモ');
  assert.equal((await db.query('select count(*)::int n from public.outing_items where item_id=$1',[cafe])).rows[0].n,1);
  await db.query("update public.items set kind='activity' where id=$1",[park]);
  await assert.rejects(set(group,park,'ChIJ_one'),e=>e.code==='42501');
 }finally{await db.close();}
});
test('place links honor lifecycle guards and cascade during existing group cleanup',async()=>{
 const {db,as}=await fixture();const {alice,bob,group,cafe,outsider,otherGroup,other}=ids;
 try{
  await as(alice,()=>db.query("select public.set_item_place($1,$2,'ChIJ_cleanup',null)",[group,cafe]));
  await db.query('update public.groups set deleting=true where id=$1',[otherGroup]);
  await assert.rejects(as(outsider,()=>db.query("select public.set_item_place($1,$2,'ChIJ_new',null)",[otherGroup,other])),e=>e.code==='42501');
  await as(bob,()=>db.query('select public.begin_leave_group($1,2,false)',[group]));
  assert.equal((await as(bob,()=>db.query('select * from public.item_places'))).rows.length,0);
  await as(alice,()=>db.query('select public.begin_leave_group($1,1,true)',[group]));
  await as(alice,()=>db.query('select public.finish_leave_group($1)',[group]));
  assert.equal((await db.query('select count(*)::int n from public.item_places')).rows[0].n,0);
 }finally{await db.close();}
});
