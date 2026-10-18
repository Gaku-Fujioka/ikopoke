import assert from 'node:assert/strict';import {test} from 'node:test';import {deleteAccount} from '../supabase/functions/delete-account/handler.ts';
const now=Date.parse('2026-10-18T04:00:00Z'),user='00000000-0000-4000-8000-000000000001',group='10000000-0000-4000-8000-000000000001',visit='40000000-0000-4000-8000-000000000001',photo='50000000-0000-4000-8000-000000000001',requestId='80000000-0000-4000-8000-000000000001';
const body={confirm:'delete-my-account',requestId,groupIds:[group],deleteGroupIds:[group]};
const request=(change={},headers={authorization:'Bearer synthetic-verified-token'})=>new Request('https://function.invalid/delete-account',{method:'POST',headers,body:JSON.stringify({...body,...change})});
function backend(options={}){
 const calls=[];let object=options.object??true,authFailure=options.authFailure??false;
 const admin={auth:{getUser:async token=>{calls.push(['getUser',token]);return {data:{user:options.signedOut?null:{id:user,last_sign_in_at:new Date(options.signedAt??now).toISOString()}},error:null};},admin:{deleteUser:async(id,soft)=>{calls.push(['deleteUser',id,soft]);if(authFailure){authFailure=false;return {error:{message:'private-auth-token'}};}return {error:null};}}},rpc:async(name,args)=>{
  calls.push([name,args]);assert.equal(args.p_user_id,user);assert.equal(args.p_request_id,requestId);
  if(name==='prepare_account_deletion')return {data:'pending',error:options.changed?{code:'40001',message:'private-membership'}:null};
  if(name==='get_account_cleanup_paths')return {data:object?[{object_path:options.path??`${group}/${visit}/${photo}.jpg`}]:[],error:null};
  if(name==='finish_account_data')assert.equal(object,false);
  return {data:null,error:null};
 },storage:{from(bucket){assert.equal(bucket,'visit-photos');return {remove:async paths=>{calls.push(['remove',paths]);if(options.storageFailure)return {error:{message:'private-storage-data'}};object=false;return {error:null};}};}}};return {admin,calls};
}
test('function verifies Auth, ignores forged user fields, removes bytes before rows and irreversibly soft deletes the verified identity',async()=>{
 const {admin,calls}=backend();const result=await deleteAccount(request({userId:'forged'}),admin,now);assert.equal(result.status,200);assert.deepEqual(await result.json(),{ok:true});
 assert.deepEqual(calls.map(c=>c[0]),['getUser','prepare_account_deletion','get_account_cleanup_paths','remove','get_account_cleanup_paths','finish_account_data','deleteUser','complete_account_deletion']);assert.deepEqual(calls.find(c=>c[0]==='deleteUser'),['deleteUser',user,true]);
});
test('missing identity, stale reauthentication and invalid confirmations never reach an admin mutation',async()=>{
 for(const [options,req,status]of [[{},request({},{}),401],[{signedOut:true},request(),401],[{signedAt:now-301000},request(),403],[{},request({confirm:'no'}),400],[{},request({groupIds:[]}),400],[{},request({requestId:'bad'}),400]]){
  const {admin,calls}=backend(options);const result=await deleteAccount(req,admin,now);assert.equal(result.status,status);assert.ok(calls.every(c=>c[0]==='getUser'));
 }
});
test('changed membership and Storage failure fail closed without deleting Auth or exposing provider details',async()=>{
 for(const [options,status]of [[{changed:true},409],[{storageFailure:true},503],[{path:`20000000-0000-4000-8000-000000000001/${visit}/${photo}.jpg`},503]]){
  const {admin,calls}=backend(options);const result=await deleteAccount(request(),admin,now);assert.equal(result.status,status);assert.ok(!calls.some(c=>c[0]==='deleteUser'));assert.ok(!calls.some(c=>c[0]==='finish_account_data'));assert.ok(!(await result.text()).includes('private'));
 }
});
test('Auth failure after data cleanup is resumable; retries do not require deleted photo bytes',async()=>{
 const {admin,calls}=backend({authFailure:true});assert.equal((await deleteAccount(request(),admin,now)).status,503);assert.equal((await deleteAccount(request(),admin,now)).status,200);assert.equal(calls.filter(c=>c[0]==='remove').length,1);assert.equal(calls.filter(c=>c[0]==='deleteUser').length,2);
});

test('profile cleanup accepts only the verified avatar or explicitly confirmed group covers',async()=>{
 for(const path of [`profile-avatar/${user}/${photo}.jpg`,`profile-cover/${group}/${photo}.jpg`]){
  const {admin}=backend({path});assert.equal((await deleteAccount(request(),admin,now)).status,200);
 }
 for(const path of [`profile-avatar/${group}/${photo}.jpg`,`profile-cover/${visit}/${photo}.jpg`,`profile-avatar/${user}/bad.jpg`]){
  const {admin,calls}=backend({path});assert.equal((await deleteAccount(request(),admin,now)).status,503);assert.ok(!calls.some(c=>c[0]==='remove'));
 }
});
