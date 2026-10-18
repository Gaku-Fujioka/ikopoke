import assert from 'node:assert/strict';import {test,beforeEach} from 'node:test';import {registerHooks} from 'node:module';
const url=s=>`data:text/javascript,${encodeURIComponent(s)}`;
const provider=url(`export const calls=[];let config={};export function configure(c={}){config=c;calls.length=0;}export async function createClient(){return {auth:{getClaims:async()=>{calls.push(['auth']);return {data:config.signedOut?null:{claims:{sub:'verified'}},error:null};}},rpc:async(name,args)=>{calls.push([name,args]);return {data:config.data??{},error:config.code?{code:config.code,message:'private-token'}:null};}};}`);
const cache=url('export const paths=[];export function revalidatePath(...p){paths.push(p);}');
registerHooks({resolve(s,c,next){if(s==='@/lib/supabase/server')return {url:provider,shortCircuit:true};if(s==='next/cache')return {url:cache,shortCircuit:true};if(s.startsWith('@/'))return {url:new URL('../'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const actions=await import('../app/app/profile/presentation-actions.ts'),backend=await import(provider),invalidations=await import(cache);
const group='10000000-0000-4000-8000-000000000001',media='90000000-0000-4000-8000-000000000001';
function form(overrides={}){const f=new FormData();for(const[k,v]of Object.entries({groupId:group,mode:'color',color:'sky',revision:'1',operation:'reserve',kind:'cover',mediaId:media,byteSize:'100',...overrides}))if(v!==null)f.set(k,v);return f;}
beforeEach(()=>{backend.configure();invalidations.paths.length=0;});
test('malformed color/media and signed-out requests cannot reach persistence',async()=>{
 assert.ok((await actions.saveGroupPresentationAction({error:null},form({color:'url(evil)'}))).error);assert.deepEqual(backend.calls,[]);
 assert.ok((await actions.profileMediaAction(form({byteSize:'999999999'}))).error);assert.deepEqual(backend.calls,[]);
 backend.configure({signedOut:true});assert.ok((await actions.profileMediaAction(form())).error);assert.deepEqual(backend.calls,[['auth']]);assert.deepEqual(invalidations.paths,[]);
});
test('personal color sends no caller identity or shared description and invalidates only after success',async()=>{
 const result=await actions.saveGroupPresentationAction({error:null},form({userId:'forged',description:'ignore'}));assert.equal(result.saved,true);
 assert.deepEqual(backend.calls[1],['save_group_presentation',{p_group:group,p_description:null,p_expected:null,p_color:'sky'}]);assert.deepEqual(invalidations.paths,[['/app','layout']]);
 backend.configure({code:'40001'});invalidations.paths.length=0;const error=await actions.saveGroupPresentationAction({error:null},form({mode:'description',description:'共有の紹介'}));assert.match(error.error,/別の画面/);assert.ok(!error.error.includes('private'));assert.deepEqual(invalidations.paths,[]);
});
test('reservations are bounded; publication uses the server-owned media and errors never appear as success',async()=>{
 backend.configure({data:{id:media,path:`profile-cover/${group}/${media}.jpg`,status:'pending'}});assert.ok((await actions.profileMediaAction(form({userId:'forged'}))).path);assert.deepEqual(invalidations.paths,[]);assert.ok(!JSON.stringify(backend.calls[1]).includes('forged'));
 backend.configure({code:'55000'});assert.ok((await actions.profileMediaAction(form({operation:'publish'}))).error);assert.deepEqual(invalidations.paths,[]);
 backend.configure({data:{id:media,path:'https://evil.invalid/image.jpg'}});assert.ok((await actions.profileMediaAction(form({operation:'publish'}))).error);assert.deepEqual(invalidations.paths,[]);
 backend.configure({data:{id:media}});assert.equal((await actions.profileMediaAction(form({operation:'publish'}))).error,null);assert.deepEqual(invalidations.paths,[['/app','layout']]);
});
