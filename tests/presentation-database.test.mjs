import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {fixture,ids} from './shared-life-fixture.mjs';
const {alice,bob,outsider,group,otherGroup}=ids;
const picture=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const token='f'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
async function edit(f,user,action,kind,gid,id,expected=null,size=100){return (await f.as(user,()=>f.db.query('select public.edit_profile_media($1,$2,$3,$4,$5,$6) value',[action,kind,gid,id,expected,size]))).rows[0].value;}
async function upload(f,user,row){await f.as(user,()=>f.db.query("insert into storage.objects(bucket_id,name,metadata,owner_id) values('visit-photos',$1,$2,$3)",[row.path,{size:100,mimetype:'image/jpeg'},user]));}
async function ready(f,user,kind,gid,id,expected=null){const row=await edit(f,user,'reserve',kind,gid,id,expected);await upload(f,user,row);await edit(f,user,'publish',kind,gid,id);return row;}
async function visible(f,user,path,role='authenticated'){return (await f.as(user,()=>f.db.query('select name from storage.objects where name=$1',[path]),role)).rows.length;}

test('personal group colors, shared description and optimistic revision are separate and protected',async()=>{
 const f=await fixture();try{
  await f.as(alice,()=>f.db.query("select public.save_group_presentation($1,'週末のおでかけ',1,null)",[group]));
  await f.as(bob,()=>f.db.query("select public.save_group_presentation($1,null,null,'sky')",[group]));
  const read=async user=>(await f.as(user,()=>f.db.query('select * from public.get_group_presentations($1)',[[group]]))).rows[0];
  assert.equal((await read(alice)).color,'apricot');assert.equal((await read(bob)).color,'sky');assert.equal((await read(bob)).description,'週末のおでかけ');
  await assert.rejects(f.as(alice,()=>f.db.query("select public.save_group_presentation($1,'古い編集',1,null)",[group])),e=>e.code==='40001');
  await assert.rejects(f.as(outsider,()=>f.db.query("select public.save_group_presentation($1,null,null,'mint')",[group])),e=>e.code==='42501');
  await assert.rejects(f.as(alice,()=>f.db.query("select public.save_group_presentation($1,null,null,'url(evil)')",[group])),e=>e.code==='22023');
  assert.equal((await f.as(outsider,()=>f.db.query('select * from public.get_group_presentations($1)',[[group]]))).rows.length,0);
  await assert.rejects(f.as(null,()=>f.db.query('select * from public.get_group_presentations($1)',[[group]]),'anon'),e=>e.code==='42501');
  assert.ok((await f.as(bob,()=>f.db.query('select * from public.group_display_preferences'))).rows.every(row=>row.user_id===bob));
  await f.db.query('insert into public.group_members values($1,$2,now())',[otherGroup,bob]);
  assert.equal((await f.as(bob,()=>f.db.query('select color from public.group_display_preferences where group_id=$1',[otherGroup]))).rows[0].color,'apricot');
 }finally{await f.db.close();}
});

test('photos require reserved uploads, match Storage metadata, preserve a concurrent winner and cannot be read by outsiders',async()=>{
 const f=await fixture();try{
  const avatar=await ready(f,alice,'avatar',null,picture(1));
  const key=createHash('md5').update('item:'+ids.cafe).digest('hex');
  const avatars=async user=>(await f.as(user,()=>f.db.query('select * from public.get_social_avatars($1,$2,false)',[group,[key]]))).rows;
  assert.deepEqual(await avatars(bob),[{key,path:avatar.path}]);assert.deepEqual(await avatars(outsider),[]);
  assert.equal((await f.as(bob,()=>f.db.query('select * from public.get_member_avatars($1)',[group]))).rows[0].path,avatar.path);
  assert.equal(await visible(f,bob,avatar.path),1);assert.equal(await visible(f,outsider,avatar.path),0);await assert.rejects(visible(f,null,avatar.path,'anon'),e=>e.code==='42501');
  assert.ok(avatar.path.startsWith('profile-avatar/')); // cannot collide with a visit's UUID namespace.
  const pending=await edit(f,alice,'reserve','cover',group,picture(2));
  await assert.rejects(edit(f,alice,'publish','cover',group,picture(2)),e=>e.code==='55000');
  await assert.rejects(upload(f,outsider,pending));
  await upload(f,alice,pending);assert.equal(await visible(f,bob,pending.path),0);
  await f.db.query('update storage.objects set metadata=$1 where name=$2',[{size:99,mimetype:'image/jpeg'},pending.path]);
  await assert.rejects(edit(f,alice,'publish','cover',group,picture(2)),e=>e.code==='55000');
  await f.db.query('update storage.objects set metadata=$1 where name=$2',[{size:100,mimetype:'image/jpeg'},pending.path]);
  await edit(f,alice,'publish','cover',group,picture(2));
  await assert.rejects(edit(f,bob,'discard','cover',group,picture(2)),e=>e.code==='42501');
  const a=await edit(f,alice,'reserve','cover',group,picture(3),picture(2));const b=await edit(f,bob,'reserve','cover',group,picture(4),picture(2));
  await upload(f,alice,a);await upload(f,bob,b);await edit(f,bob,'publish','cover',group,picture(4));
  await assert.rejects(edit(f,alice,'publish','cover',group,picture(3)),e=>e.code==='40001');
  await edit(f,alice,'discard','cover',group,picture(3));await assert.rejects(upload(f,alice,a));
  await assert.rejects(edit(f,alice,'forget','cover',group,picture(3)),e=>e.code==='55000');
  await f.as(alice,()=>f.db.query('delete from storage.objects where name=$1',[a.path]));await edit(f,alice,'forget','cover',group,picture(3));
  assert.equal(await visible(f,bob,pending.path),1);assert.equal(await visible(f,outsider,b.path),0);
  await f.db.query('delete from public.group_members where group_id=$1 and user_id=$2',[group,bob]);assert.equal(await visible(f,bob,avatar.path),0);
 }finally{await f.db.close();}
});

test('authenticated valid invitations reveal only the shared profile; revoke and expiry immediately revoke byte access',async()=>{
 const f=await fixture();try{
  const cover=await ready(f,alice,'cover',group,picture(1)),avatar=await ready(f,alice,'avatar',null,picture(2));
  const issued=await f.as(alice,()=>f.db.query('select * from public.create_group_invite($1,$2)',[group,hash]));
  assert.equal(await visible(f,outsider,cover.path),0);
  await assert.rejects(f.as(null,()=>f.db.query('select public.preview_group_profile($1)',[token]),'anon'),e=>e.code==='42501');
  const preview=(await f.as(outsider,()=>f.db.query('select public.preview_group_profile($1) value',[token]))).rows[0].value;
  assert.equal(preview.group_id,group);assert.equal(preview.cover_path,cover.path);assert.ok(!JSON.stringify(preview).includes(alice));
  assert.equal(await visible(f,outsider,cover.path),1);assert.equal(await visible(f,outsider,avatar.path),0);
  await f.as(alice,()=>f.db.query('select public.revoke_group_invite($1)',[issued.rows[0].id]));assert.equal(await visible(f,outsider,cover.path),0);
  await assert.rejects(f.as(outsider,()=>f.db.query('select public.preview_group_profile($1)',[token])));
  await f.db.query('update public.group_invites set revoked_at=null,expires_at=now()-interval \'1 minute\' where id=$1',[issued.rows[0].id]);assert.equal(await visible(f,outsider,cover.path),0);
 }finally{await f.db.close();}
});

test('last-member and account removal include profile bytes and refuse to delete metadata while bytes remain',async()=>{
 const f=await fixture();try{
  const cover=await ready(f,outsider,'cover',otherGroup,picture(1));
  await f.as(outsider,()=>f.db.query('select public.begin_leave_group($1,1,true)',[otherGroup]));
  assert.equal((await f.as(outsider,()=>f.db.query('select * from public.get_group_cleanup_paths($1)',[otherGroup]))).rows[0].object_path,cover.path);
  await assert.rejects(f.as(outsider,()=>f.db.query('select public.finish_leave_group($1)',[otherGroup])),e=>e.code==='55000');
  await f.as(outsider,()=>f.db.query('delete from storage.objects where name=$1',[cover.path]));await f.as(outsider,()=>f.db.query('select public.finish_leave_group($1)',[otherGroup]));
  const avatar=await ready(f,alice,'avatar',null,picture(2));
  const unfinished=await edit(f,alice,'reserve','avatar',null,picture(4),picture(2));
  const sharedCover=await ready(f,alice,'cover',group,picture(3));const request=picture(9);
  await f.as(null,()=>f.db.query('select public.prepare_account_deletion($1,$2,$3,$4)',[alice,request,[group],[]]),'service_role');
  await assert.rejects(upload(f,alice,unfinished),e=>e.code==='42501');
  assert.equal((await f.db.query('select avatar_media_id from public.profiles where user_id=$1',[alice])).rows[0].avatar_media_id,null);
  assert.equal((await f.as(null,()=>f.db.query('select * from public.get_account_cleanup_paths($1,$2)',[alice,request]),'service_role')).rows[0].object_path,avatar.path);
  await assert.rejects(f.as(null,()=>f.db.query('select public.finish_account_data($1,$2)',[alice,request]),'service_role'),e=>e.code==='55000');
  await f.db.query('delete from storage.objects where name=$1',[avatar.path]);await f.as(null,()=>f.db.query('select public.finish_account_data($1,$2)',[alice,request]),'service_role');
  assert.equal((await f.db.query('select * from public.profile_media where id=$1',[picture(2)])).rows.length,0);
  assert.equal(await visible(f,bob,sharedCover.path),1);assert.equal(await visible(f,alice,sharedCover.path),0);
  await edit(f,bob,'detach','cover',group,null,picture(3));await edit(f,bob,'discard','cover',group,picture(3));
  await f.as(bob,()=>f.db.query('delete from storage.objects where name=$1',[sharedCover.path]));await edit(f,bob,'forget','cover',group,picture(3));
 }finally{await f.db.close();}
});
