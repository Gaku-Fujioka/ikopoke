import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,ids} from './shared-life-fixture.mjs';
const {alice,bob,outsider,group,otherGroup,plan,visit,cafe}=ids;
const id=n=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=(f,user,sql,args=[],role='authenticated')=>f.as(user,()=>f.db.query(sql,args),role);
const rpc=async(f,user,name,args)=>(await query(f,user,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;
async function setup(){const f=await fixture();f.memory=await rpc(f,alice,'open_memory_book',[group,plan]);return f;}
const mutate=(f,user,operation,data)=>rpc(f,user,'mutate_memory_book',[f.memory,operation,data]);
const book=(f,user=alice)=>rpc(f,user,'get_memory_book',[f.memory]);
const add=(f,user,key,after=null,title='帰り道')=>mutate(f,user,'add_page',{id:key,page_id:after,title,body:'アイスを半分こ'});
const word=(f,user,key,page=null,body='楽しかった',revision=0)=>mutate(f,user,'save_word',{id:key,page_id:page,body,revision});
const fails=(p,code)=>assert.rejects(p,e=>e.code===code);
async function readyPhoto(f,page=id(1),photo=id(9),user=alice){
 const reserved=await mutate(f,user,'reserve_photo',{id:photo,page_id:page,content_type:'image/jpeg',byte_size:12});
 await query(f,user,"insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,$2)",[reserved.object_path,{size:12,mimetype:'image/jpeg'}]);
 await mutate(f,user,'finish_photo',{id:photo,page_id:page});return reserved.object_path;
}

test('a book opens before completion, stays unique, and preserves writing across finish/undo/refinish',async()=>{
 const f=await setup();try{
  assert.equal(await rpc(f,bob,'open_memory_book',[group,plan]),f.memory);
  assert.equal((await f.db.query('select completed_at from public.outings where id=$1',[plan])).rows[0].completed_at,null);
  await add(f,alice,id(1));await word(f,bob,id(2));
  for(const [completed,revision] of [[true,1],[false,2],[true,3]])assert.equal(await rpc(f,alice,'set_outing_completed',[group,plan,completed,revision]),f.memory);
  const saved=await book(f);assert.equal(saved.pages.length,1);assert.equal(saved.words[0].body,'楽しかった');
 }finally{await f.db.close();}
});
test('page insertion is ordered, idempotent and scoped; visit titles do not change the actual visit or candidate',async()=>{
 const f=await setup();try{
  await rpc(f,alice,'record_timed_visit',[group,cafe,plan,'2026-10-18','訪問メモ',null,visit,null,null]);
  await add(f,alice,id(1),visit,'アイス');await add(f,bob,id(2),visit,'車内');await add(f,alice,id(3),id(2),'駅');
  assert.deepEqual((await book(f)).pages.filter(p=>!p.visit_id).sort((a,b)=>a.position-b.position).map(p=>p.title),['車内','駅','アイス']);
  await add(f,alice,id(1),visit,'アイス');assert.equal((await book(f)).pages.filter(p=>!p.visit_id).length,3);
  await mutate(f,bob,'edit_page',{id:visit,title:'プリンを半分こ',body:'',revision:0});
  assert.equal((await f.db.query('select item_title from public.visits where id=$1',[visit])).rows[0].item_title,'カフェ.*');
  assert.equal((await f.db.query('select title from public.items where id=$1',[cafe])).rows[0].title,'カフェ.*');
  await fails(mutate(f,alice,'edit_page',{id:visit,title:'古い変更',body:'',revision:0}),'40001');
  await mutate(f,alice,'edit_page',{id:visit,title:'',body:'',revision:1});
  await mutate(f,bob,'edit_page',{id:id(1),title:'二人の帰り道',body:'共有の本文',revision:1});
  await fails(mutate(f,alice,'edit_page',{id:id(1),title:'古い本文',body:'',revision:1}),'40001');
  await fails(add(f,alice,id(4),id(800)),'42501');
 }finally{await f.db.close();}
});
test('page words and guestbook carry names, edit/delete only by their author, reject stale writes and never resurrect on retry',async()=>{
 const f=await setup();try{
  await add(f,alice,id(1));await word(f,alice,id(2),id(1));await word(f,bob,id(3));await word(f,alice,id(2),id(1));
  const saved=await book(f,bob);assert.equal(saved.words.length,2);assert.equal(saved.words[0].author_name,'あおい');assert.equal(saved.words[0].is_mine,false);assert.equal(saved.words[1].is_mine,true);assert.ok(!JSON.stringify(saved).includes(alice));
  await fails(word(f,bob,id(2),id(1),'改ざん',1),'42501');
  await word(f,alice,id(2),id(1),'帰宅後の追記',1);
  await fails(word(f,alice,id(2),id(1),'古い追記',1),'40001');
  await fails(mutate(f,alice,'delete_word',{id:id(2),page_id:id(1),revision:2}),'22023');
  await mutate(f,alice,'delete_word',{id:id(2),page_id:id(1),revision:2,confirm:true});
  await fails(word(f,alice,id(2),id(1)),'40001');assert.equal((await book(f)).words.length,1);
  await fails(word(f,alice,id(4),null,'　\u00a0'),'22023');await fails(word(f,alice,id(4),null,'あ'.repeat(501)),'22023');
 }finally{await f.db.close();}
});
test('nonmembers, forged IDs, anonymous calls and direct table writes cannot read or mutate book data',async()=>{
 const f=await setup();try{
  await add(f,alice,id(1));await word(f,alice,id(2));
  for(const user of [outsider,null]){await fails(book(f,user),'42501');await fails(add(f,user,id(3)),user?'42501':'28000');}
  await fails(rpc(f,outsider,'open_memory_book',[otherGroup,plan]),'42501');
  await query(f,outsider,'select id from public.memory_pages').then(r=>assert.equal(r.rows.length,0));
  await query(f,outsider,'select id from public.memory_words').then(r=>assert.equal(r.rows.length,0));
  for(const sql of ["update public.memory_pages set title='x'","delete from public.memory_words","insert into public.memory_words(id,memory_id,group_id,body,created_by) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'x',auth.uid())"])
   await fails(query(f,alice,sql),'42501');
  await fails(query(f,null,'select public.get_memory_book($1)',[f.memory],'anon'),'42501');
  await fails(query(f,alice,"select kokoiko_private.resolve_memory_page($1,$2)",[f.memory,id(9)]),'42501');
 }finally{await f.db.close();}
});
test('free-page uploads verify Storage metadata, remain private, can become covers, and support retry/cancel without orphan bytes',async()=>{
 const f=await setup();try{
  await add(f,alice,id(1));const path=await readyPhoto(f);
  assert.equal((await book(f,bob)).photos[0].status,'ready');assert.equal((await query(f,outsider,'select name from storage.objects')).rows.length,0);
  await rpc(f,bob,'set_memory_cover',[group,f.memory,id(9),1]);
  await fails(mutate(f,bob,'begin_remove_photo',{id:id(9),page_id:id(1)}),'42501');
  await mutate(f,alice,'begin_remove_photo',{id:id(9),page_id:id(1)});
  await fails(mutate(f,alice,'finish_remove_photo',{id:id(9),page_id:id(1)}),'55000');
  await query(f,alice,'delete from storage.objects where name=$1',[path]);
  await mutate(f,alice,'finish_remove_photo',{id:id(9),page_id:id(1)});
  assert.equal((await f.db.query('select cover_photo_id from public.memories where id=$1',[f.memory])).rows[0].cover_photo_id,null);
  const r=await mutate(f,alice,'reserve_photo',{id:id(10),page_id:id(1),content_type:'image/png',byte_size:12});
  await fails(mutate(f,alice,'finish_photo',{id:id(10),page_id:id(1)}),'55000');
  await mutate(f,alice,'begin_remove_photo',{id:id(10),page_id:id(1)});
  await fails(query(f,alice,"insert into storage.objects(bucket_id,name,metadata) values('visit-photos',$1,'{}')",[r.object_path]),'42501');
  await mutate(f,alice,'finish_remove_photo',{id:id(10),page_id:id(1)});
 }finally{await f.db.close();}
});
test('free-page removal confirms collateral words/photos, waits for bytes, blocks further writes and does not recreate a deleted page',async()=>{
 const f=await setup();try{
  await add(f,alice,id(1));await word(f,bob,id(2),id(1));const path=await readyPhoto(f);
  const remove={page_id:id(1),revision:1,confirm:true};
  await fails(mutate(f,bob,'begin_remove_page',remove),'42501');
  await fails(mutate(f,alice,'begin_remove_page',{...remove,confirm:false}),'22023');
  const result=await mutate(f,alice,'begin_remove_page',remove);assert.deepEqual(result.paths,[path]);
  await fails(word(f,bob,id(3),id(1)),'55000');await fails(mutate(f,alice,'finish_remove_page',remove),'55000');
  await query(f,alice,'delete from storage.objects where name=$1',[path]);await mutate(f,alice,'finish_remove_page',remove);
  const saved=await book(f);assert.equal(saved.pages.length,0);assert.equal(saved.words.length,0);assert.equal(saved.photos.length,0);await fails(add(f,alice,id(1)),'23505');
 }finally{await f.db.close();}
});
test('departure anonymizes words, preserves ready page photos, and final-group deletion includes all new data/bytes',async()=>{
 const f=await setup();try{
  await add(f,alice,id(1));await word(f,alice,id(2));const path=await readyPhoto(f);
  await rpc(f,alice,'begin_leave_group',[group,2,false]);
  const saved=await book(f,bob);assert.equal(saved.words[0].author_name,'退出したメンバー');assert.equal(saved.pages[0].can_delete,true);assert.equal(saved.photos[0].can_delete,true);
  await fails(book(f,alice),'42501');
  await rpc(f,bob,'begin_leave_group',[group,1,true]);
  assert.ok((await query(f,bob,'select * from public.get_group_cleanup_paths($1)',[group])).rows.some(p=>p.object_path===path));
  await fails(rpc(f,bob,'finish_leave_group',[group]),'55000');
  await query(f,bob,'delete from storage.objects where name=$1',[path]);await rpc(f,bob,'finish_leave_group',[group]);
  assert.equal((await f.db.query('select count(*)::int n from public.memory_pages')).rows[0].n,0);assert.equal((await f.db.query('select count(*)::int n from public.memory_words')).rows[0].n,0);
 }finally{await f.db.close();}
});

test('removing a visit deletes its book words but retains anchored free pages, words and photos at the start',async()=>{
 const f=await setup();try{
  await rpc(f,alice,'record_timed_visit',[group,cafe,plan,'2026-10-18','訪問メモ',null,visit,null,null]);
  await add(f,alice,id(1),visit);await word(f,bob,id(2),visit);await word(f,bob,id(3),id(1));const path=await readyPhoto(f);
  await query(f,alice,'select * from public.begin_remove_visit($1,$2,1)',[group,visit]);
  await rpc(f,alice,'finish_remove_visit',[group,visit]);
  const saved=await book(f);assert.equal(saved.pages.length,1);assert.equal(saved.pages[0].after_visit_id,null);assert.equal(saved.words.length,1);assert.equal(saved.words[0].page_id,id(1));assert.equal(saved.photos[0].object_path,path);
 }finally{await f.db.close();}
});
