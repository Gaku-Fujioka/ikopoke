import assert from 'node:assert/strict';import {test,beforeEach} from 'node:test';import {registerHooks} from 'node:module';
const url=s=>`data:text/javascript,${encodeURIComponent(s)}`;
const providerURL=url(`export const calls=[];let config={};export function configure(c={}){config=c;calls.length=0;}
export async function createClient(){return {auth:{getUser:async()=>{calls.push(['auth']);return {data:{user:config.signedOut?null:{id:'verified',email:'synthetic@example.invalid'}},error:null};},signInWithPassword:async input=>{calls.push(['reauth',input]);return {error:config.passwordFailure?{message:'private'}:null};},signOut:async()=>{calls.push(['signOut']);return {error:null};}},functions:{invoke:async(name,input)=>{calls.push(['invoke',name,input]);return {data:config.invokeFailure?null:{ok:true},error:config.invokeFailure?{message:'private-server'}:null};}},rpc:async(name,input)=>{calls.push([name,input]);if(name==='begin_leave_group')return {data:config.last??false,error:config.changed?{code:'40001',message:'private-count'}:null};if(name==='get_group_cleanup_paths')return {data:config.object?[{object_path:'safe/server/path.jpg'}]:[],error:null};return {data:null,error:null};},storage:{from:()=>({remove:async paths=>{calls.push(['remove',paths]);if(!config.storageFailure)config.object=false;return {error:config.storageFailure?{message:'private-storage'}:null};}})}};}`);
const cacheURL=url('export const paths=[];export function revalidatePath(...args){paths.push(args);}');
const navURL=url("export function redirect(location){throw Object.assign(Error('redirect'),{location});}");
registerHooks({resolve(specifier,context,next){const overrides={'@/lib/supabase/server':providerURL,'next/cache':cacheURL,'next/navigation':navURL};if(overrides[specifier])return {url:overrides[specifier],shortCircuit:true};if(specifier.startsWith('@/'))return {url:new URL(`../${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const {leaveGroupAction}=await import('../app/app/groups/departure-actions.ts'),{deleteMyAccountAction}=await import('../app/app/profile/delete-actions.ts');const provider=await import(providerURL),cache=await import(cacheURL);
const group='10000000-0000-4000-8000-000000000001',requestId='80000000-0000-4000-8000-000000000001';
function form(change={}){const f=new FormData();for(const[k,v]of Object.entries({groupId:group,memberCount:'2',confirm:'yes',requestId,password:'synthetic-password',groupIds:JSON.stringify([group]),deleteGroupIds:'[]',...change}))if(v!==null)f.set(k,v);return f;}
beforeEach(()=>{provider.configure();cache.paths.length=0;});
test('unconfirmed or signed-out departures and account deletions never reach a mutation',async()=>{
 for(const action of [leaveGroupAction,deleteMyAccountAction]){assert.ok((await action({error:null},form({confirm:null}))).error);assert.deepEqual(provider.calls,[]);provider.configure({signedOut:true});assert.ok((await action({error:null},form())).error);assert.deepEqual(provider.calls,[['auth']]);provider.configure();}assert.deepEqual(cache.paths,[]);
});
test('non-last departure skips photo deletion and redirects only after the database accepts it',async()=>{
 await assert.rejects(leaveGroupAction({error:null},form()),e=>e.location==='/app');assert.deepEqual(provider.calls.map(c=>c[0]),['auth','begin_leave_group']);assert.deepEqual(cache.paths,[['/app','layout']]);
});
test('changed membership and failed Storage deletion never claim a completed last-member departure',async()=>{
 provider.configure({changed:true});assert.ok((await leaveGroupAction({error:null},form())).error);assert.ok(!JSON.stringify(await leaveGroupAction({error:null},form())).includes('private'));
 provider.configure({last:true,object:true,storageFailure:true});const result=await leaveGroupAction({error:null},form({memberCount:'1',deleteLast:'yes'}));assert.ok(result.error);assert.ok(!provider.calls.some(c=>c[0]==='finish_leave_group'));assert.deepEqual(cache.paths,[]);
});
test('account deletion reauthenticates and forwards confirmation IDs without passwords or caller-supplied user identity',async()=>{
 await assert.rejects(deleteMyAccountAction({error:null},form({userId:'forged'})),e=>e.location==='/auth/login?account=deleted');
 assert.deepEqual(provider.calls.map(c=>c[0]),['auth','reauth','invoke','signOut']);const body=provider.calls.find(c=>c[0]==='invoke')[2].body;assert.deepEqual(body,{confirm:'delete-my-account',requestId,groupIds:[group],deleteGroupIds:[]});assert.ok(!JSON.stringify(body).includes('password'));assert.ok(!JSON.stringify(body).includes('forged'));
});
test('failed reauthentication or server cleanup retains the page for retry and hides provider errors',async()=>{
 provider.configure({passwordFailure:true});assert.ok((await deleteMyAccountAction({error:null},form())).error);assert.ok(!provider.calls.some(c=>c[0]==='invoke'));
 provider.configure({invokeFailure:true});const result=await deleteMyAccountAction({error:null},form());assert.ok(result.error);assert.ok(!result.error.includes('private'));assert.ok(!provider.calls.some(c=>c[0]==='signOut'));assert.deepEqual(cache.paths,[]);
});
