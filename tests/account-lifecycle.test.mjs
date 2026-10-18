import {createHash} from "node:crypto";
import assert from 'node:assert/strict';import {test} from 'node:test';import {fixture,ids} from './shared-life-fixture.mjs';
const {alice,bob,outsider,group,cafe,plan,visit,photo,photo2,comment}=ids;
const fails=(p,code)=>assert.rejects(p,e=>e.code===code);
async function populate(db,as){
  await as(alice,()=>db.query("select public.record_visit($1,$2,$3,'2026-10-18','記録',5,$4)",[group,cafe,plan,visit]));await as(alice,()=>db.query("select public.create_item_comment($1,$2,'共有コメント',$3)",[group,cafe,comment]));
  for(const id of [photo,photo2])await as(alice,async()=>{const row=(await db.query("select * from public.reserve_visit_photo($1,$2,$3,'image/jpeg',12)",[group,visit,id])).rows[0];await db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[row.object_path,{size:12,mimetype:'image/jpeg'}]);if(id===photo)await db.query('select public.finish_visit_photo($1,$2,$3)',[group,visit,id]);});
}
test('leaving retains shared history, masks author names and transfers deletion rights without leaking active pending photos',async()=>{
  const {db,as}=await fixture();try{
    await populate(db,as);assert.deepEqual((await as(bob,()=>db.query('select id from public.visit_photos order by id'))).rows.map(r=>r.id),[photo]);
    await as(alice,()=>fails(db.query('select public.begin_leave_group($1,1,true)',[group]),'40001'));
    await as(alice,()=>db.query('select public.begin_leave_group($1,2,false)',[group]));
    const names=(await as(bob,()=>db.query('select * from public.get_named_item_comments($1,$2,1)',[group,cafe]))).rows[0].comments;assert.equal(names[0].display_name,'退出したメンバー');assert.equal(names[0].can_delete,true);
    assert.equal((await as(bob,()=>db.query('select * from public.get_visit_permissions($1,$2)',[group,visit]))).rows[0].can_delete,true);
    assert.deepEqual((await as(bob,()=>db.query('select id,status from public.visit_photos order by id'))).rows,[{id:photo,status:'ready'},{id:photo2,status:'cancelling'}]);
    await as(alice,()=>fails(db.query('select public.get_named_item_comments($1,$2,1)',[group,cafe]),'42501'));assert.deepEqual((await as(alice,()=>db.query('select id from public.items'))).rows,[]);
    await as(bob,async()=>{const path=(await db.query('select public.begin_remove_photo($1,$2,$3) path',[group,visit,photo2])).rows[0].path;await db.query("delete from storage.objects where bucket_id='visit-photos' and name=$1",[path]);await db.query('select public.finish_remove_photo($1,$2,$3)',[group,visit,photo2]);});
    assert.equal((await db.query('select count(*)::int n from public.outing_participants where outing_id=$1',[plan])).rows[0].n,2);
  }finally{await db.close();}
});
test('last-member exit requires confirmation, freezes joins and edits, removes Storage first and can resume',async()=>{
  const {db,as}=await fixture();try{
    await populate(db,as);await as(alice,()=>db.query('select public.begin_leave_group($1,2,false)',[group]));
    await as(bob,()=>fails(db.query('select public.begin_leave_group($1,1,false)',[group]),'22023'));
    const token='c'.repeat(64),hash=createHash('sha256').update(token).digest('hex');await as(bob,()=>db.query('select public.create_group_invite($1,$2)',[group,hash]));
    await as(bob,()=>db.query('select public.begin_leave_group($1,1,true)',[group]));
    await as(outsider,()=>fails(db.query('select public.accept_group_invite($1,$2)',[token,group]),'55000'));
    await as(bob,()=>fails(db.query("select public.create_item($1,'停止中','spot','',gen_random_uuid())",[group]),'55000'));
    await fails(db.query('insert into public.group_members(group_id,user_id) values($1,$2)',[group,outsider]),'55000');
    await as(bob,()=>fails(db.query('select public.finish_leave_group($1)',[group]),'55000'));
    const paths=(await as(bob,()=>db.query('select * from public.get_group_cleanup_paths($1)',[group]))).rows;assert.equal(paths.length,2);
    await as(bob,()=>db.query('select public.begin_leave_group($1,1,true)',[group]));
    // SQL here is solely a local Storage API fixture, never a production deletion.
    await as(bob,()=>db.query("delete from storage.objects where bucket_id='visit-photos' and name=any($1)",[paths.map(p=>p.object_path)]));await as(bob,()=>db.query('select public.finish_leave_group($1)',[group]));await as(bob,()=>db.query('select public.finish_leave_group($1)',[group]));
    assert.equal((await db.query('select count(*)::int n from public.groups where id=$1',[group])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.visits')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,0);
  }finally{await db.close();}
});
test('account deletion is server-only, checks the confirmed groups and blocks stale-session writes before Auth deletion',async()=>{
  const {db,as}=await fixture();const solo='10000000-0000-4000-8000-000000000010',soloItem='20000000-0000-4000-8000-000000000010',soloVisit='40000000-0000-4000-8000-000000000010',soloPhoto='50000000-0000-4000-8000-000000000010',request='80000000-0000-4000-8000-000000000001';
  const prepare=(groups=[group,solo],deleted=[solo])=>db.query('select public.prepare_account_deletion($1,$2,$3,$4)',[alice,request,groups,deleted]);const server=fn=>as(null,fn,'service_role');
  try{
    await populate(db,as);await as(alice,async()=>{await db.query("select public.create_group('自分だけ',$1)",[solo]);await db.query("select public.create_item($1,'一人の候補','spot','',$2)",[solo,soloItem]);await db.query("select public.record_visit($1,$2,null,'2026-10-18','',null,$3)",[solo,soloItem,soloVisit]);const r=(await db.query("select * from public.reserve_visit_photo($1,$2,$3,'image/jpeg',12)",[solo,soloVisit,soloPhoto])).rows[0];await db.query("insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[r.object_path,{size:12,mimetype:'image/jpeg'}]);await db.query('select public.finish_visit_photo($1,$2,$3)',[solo,soloVisit,soloPhoto]);});
    await as(alice,()=>fails(prepare(),'42501'));await server(()=>fails(prepare([group,solo],[]),'40001'));assert.equal((await db.query('select count(*)::int n from kokoiko_private.account_deletions')).rows[0].n,0);
    await server(prepare);await server(prepare);await server(()=>fails(prepare([group,solo],[]),'40001'));
    for(const sql of ["select public.create_group('復活',gen_random_uuid())","select public.set_my_display_name('復活')"])await as(alice,()=>fails(db.query(sql),'55000'));
    assert.equal((await db.query('select display_name from public.profiles where user_id=$1',[alice])).rows[0].display_name,'退出したメンバー');
    assert.equal((await as(bob,()=>db.query('select * from public.get_named_item_comments($1,$2,1)',[group,cafe]))).rows[0].comments[0].display_name,'退出したメンバー');
    await server(()=>fails(db.query('select public.finish_account_data($1,$2)',[alice,request]),'55000'));
    const cleanup=(await server(()=>db.query('select * from public.get_account_cleanup_paths($1,$2)',[alice,request]))).rows;assert.equal(cleanup.length,1);assert.ok(cleanup[0].object_path.startsWith(solo+'/'));
    await db.query("delete from storage.objects where bucket_id='visit-photos' and name=$1",[cleanup[0].object_path]);await server(()=>db.query('select public.finish_account_data($1,$2)',[alice,request]));await server(()=>db.query('select public.finish_account_data($1,$2)',[alice,request]));
    assert.deepEqual((await as(alice,()=>db.query('select id from public.groups'))).rows,[]);assert.equal((await db.query('select count(*)::int n from public.visit_photos where group_id=$1',[group])).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[alice])).rows[0].n,1);
    await server(()=>db.query('select public.complete_account_deletion($1,$2)',[alice,request]));assert.deepEqual((await as(alice,()=>db.query('select * from public.get_my_account_deletion()'))).rows[0].group_ids,[]);
    await as(bob,()=>db.query('select public.delete_item_comment($1,$2,$3,1)',[group,cafe,comment]));
  }finally{await db.close();}
});
