import assert from 'node:assert/strict';import {before,after,test} from 'node:test';import {fixture,ids} from './shared-life-fixture.mjs';
let db,as;const {alice,bob,outsider,group,otherGroup,cafe,park,comment,visit}=ids;
before(async()=>({db,as}=await fixture()));after(async()=>db?.close());
const browse=(args={})=>db.query('select * from public.browse_items($1,$2,null,null,null,false,$3,$4,$5,$6,1)',[args.group===undefined?group:args.group,args.q??'',args.archived??false,args.visited??null,args.priority??null,args.sort??'newest']).then(r=>r.rows[0]);
const fails=(p,code)=>assert.rejects(p,e=>e.code===code);
test('priority and want count combine equally; visit and archive filters use group records',async()=>{
  await as(alice,()=>db.query('select public.set_item_attributes($1,$2,2,0,false,false)',[group,cafe]));
  await as(alice,()=>db.query("select public.set_item_reaction($1,$2,'want_to_go')",[group,park]));await as(bob,()=>db.query("select public.set_item_reaction($1,$2,'want_to_go')",[group,park]));
  const recommended=await as(alice,()=>browse({sort:'recommended'}));assert.deepEqual(recommended.items.map(i=>i.id),[park,cafe]);assert.deepEqual(recommended.items.map(i=>i.score),[2,2]);
  await as(bob,()=>db.query("select public.record_visit($1,$2,null,'2026-10-18','',null,$3)",[group,cafe,visit]));
  assert.deepEqual((await as(alice,()=>browse({visited:'visited'}))).items.map(i=>i.id),[cafe]);assert.deepEqual((await as(alice,()=>browse({visited:'unvisited'}))).items.map(i=>i.id),[park]);
  assert.equal((await as(alice,()=>browse({q:'.*'}))).items[0].id,cafe);
  await as(alice,()=>db.query('select public.set_item_attributes($1,$2,3,2,true,false)',[group,cafe]));assert.equal((await as(alice,()=>browse())).items.length,1);assert.equal((await as(alice,()=>browse({archived:true,priority:3}))).items[0].id,cafe);
  await as(bob,()=>fails(db.query('select public.set_item_attributes($1,$2,1,2,false,false)',[group,cafe]),'40001'));
  await as(bob,()=>db.query('select public.set_item_attributes($1,$2,3,3,false,true)',[group,cafe]));assert.equal((await db.query('select count(*)::int n from public.visits')).rows[0].n,1);
});
test('all-group browse is membership bounded; outsiders, anonymous, direct updates rejected',async()=>{
  assert.equal((await as(alice,()=>browse({group:null}))).items.length,2);
  await as(outsider,()=>fails(browse(),'42501'));await as(alice,()=>fails(browse({group:otherGroup}),'42501'));await as(null,()=>fails(browse(),'42501'),'anon');
  await as(alice,()=>fails(db.query('update public.items set priority=3'),'42501'));
});
test('names omit user identities; comments are owner edited, stale guarded and former authors deletable',async()=>{
  await as(alice,()=>db.query("select public.create_item_comment($1,$2,'こんにちは',$3)",[group,cafe,comment]));
  const read=()=>db.query('select * from public.get_named_item_comments($1,$2,1)',[group,cafe]).then(r=>r.rows[0].comments[0]);
  const own=await as(alice,read);assert.equal(own.display_name,'あおい');assert.equal(own.is_mine,true);assert.equal(own.can_delete,true);assert.ok(!JSON.stringify(own).includes(alice));
  const other=await as(bob,read);assert.equal(other.can_delete,false);await as(bob,()=>fails(db.query("select public.edit_item_comment($1,$2,$3,'bad',1)",[group,cafe,comment]),'42501'));await as(bob,()=>fails(db.query('select public.delete_item_comment($1,$2,$3,1)',[group,cafe,comment]),'42501'));
  await as(alice,()=>db.query("select public.edit_item_comment($1,$2,$3,'変更',1)",[group,cafe,comment]));await as(alice,()=>fails(db.query("select public.edit_item_comment($1,$2,$3,'stale',1)",[group,cafe,comment]),'40001'));
  // A profile must never be joined for a user no longer in this group.
  await db.query('delete from public.outing_participants where user_id=$1',[alice]);await db.query('delete from public.group_members where group_id=$1 and user_id=$2',[group,alice]);
  const former=await as(bob,read);assert.equal(former.display_name,'退出したメンバー');assert.equal(former.can_delete,true);
  await as(bob,()=>db.query('select public.delete_item_comment($1,$2,$3,2)',[group,cafe,comment]));assert.equal((await as(bob,()=>db.query('select * from public.get_named_item_reactions($1,$2)',[group,park]))).rows[0].display_name,'はる');
  await as(alice,()=>fails(read(),'42501'));
});
