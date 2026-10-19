import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {registerHooks} from 'node:module';
const url=s=>`data:text/javascript,${encodeURIComponent(s)}`;
const provider=url(`export const calls=[];let config={};export function configure(c={}){config=c;calls.length=0;}export async function createClient(){return {auth:{getClaims:async()=>({data:config.signedOut?null:{claims:{sub:'verified'}},error:null})},rpc:async(name,args)=>{calls.push({name,args});if(config.throw)throw Error('private-token');let data=config.result??{id:args.p_data?.id,revision:1};if(name==='open_memory_book')data='b0000000-0000-4000-8000-000000000001';return {data:config.missing?null:data,error:config.code?{code:config.code,message:'private-token'}:null};},storage:{from:()=>({remove:async paths=>{calls.push({remove:paths});if(config.storageThrow)throw Error('lost response');return {error:null};}})}};}`);
const cache=url(`export const paths=[];export function revalidatePath(...args){paths.push(args);}`);
const env=url(`export let hasEnvVars=true;export function configure(v){hasEnvVars=v;}`);
registerHooks({resolve(s,c,next){const mapped={'@/lib/supabase/server':provider,'@/lib/utils':env,'next/cache':cache,'next/navigation':url(`export function redirect(location){throw Object.assign(Error('redirect'),{location});}`)}[s];if(mapped)return {url:mapped,shortCircuit:true};if(s.startsWith('@/'))return {url:new URL('../'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const backend=await import(provider),invalidations=await import(cache),environment=await import(env),actions=await import('../app/app/groups/[groupId]/memories/book-actions.ts');
const id=n=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function form(values={}){const f=new FormData();for(const[k,v]of Object.entries({groupId:id(1),memoryId:id(2),id:id(3),pageId:'',revision:'0',operation:'save_word',body:' 楽しかった ',...values}))if(v!==null)f.set(k,v);return f;}
beforeEach(()=>{backend.configure();invalidations.paths.length=0;environment.configure(true);});
test('invalid IDs, operations, blank words, limits and missing sessions never mutate',async()=>{
 for(const values of [{memoryId:'invalid'},{revision:'-1'},{operation:'arbitrary'},{body:'　'},{body:'あ'.repeat(501)},{operation:'add_page',title:'　'},{operation:'edit_page',title:'',freePage:'true'}])assert.ok((await actions.saveBookAction({error:null},form(values))).error);
 assert.deepEqual(backend.calls,[]);backend.configure({signedOut:true});assert.ok((await actions.saveBookAction({error:null},form())).error);assert.deepEqual(backend.calls,[]);assert.deepEqual(invalidations.paths,[]);
});
test('saving uses verified identity and fixed operation payloads, preserves UUID/revision, and refreshes only on success',async()=>{
 const result=await actions.saveBookAction({error:null},form({ownerId:'forged',pageId:id(4)}));assert.equal(result.saved,true);
 assert.deepEqual(backend.calls[0],{name:'mutate_memory_book',args:{p_memory:id(2),p_operation:'save_word',p_data:{id:id(3),page_id:id(4),revision:0,body:'楽しかった'}}});
 assert.ok(invalidations.paths.some(([path])=>path===`/app/groups/${id(1)}/memories/${id(2)}`));
 for(const config of [{code:'40001'},{code:'42501'},{throw:true},{missing:true}]){backend.configure(config);invalidations.paths.length=0;const failed=await actions.saveBookAction({error:null},form());assert.ok(failed.error);assert.ok(!failed.error.includes('private'));assert.equal(failed.saved,undefined);assert.deepEqual(invalidations.paths,[]);}
});
test('deletion requires confirmation; page names and body are independent from visit records',async()=>{
 assert.ok((await actions.saveBookAction({error:null},form({operation:'delete_word',revision:'1'}))).error);assert.deepEqual(backend.calls,[]);
 await actions.saveBookAction({error:null},form({operation:'delete_word',revision:'1',confirm:'delete'}));assert.equal(backend.calls[0].args.p_data.confirm,true);
 backend.configure();await actions.saveBookAction({error:null},form({operation:'edit_page',title:' 帰り道 ',body:'二人でアイス',revision:'2'}));assert.deepEqual(backend.calls[0].args.p_data,{id:id(3),page_id:null,revision:2,title:'帰り道',body:'二人でアイス'});
});
test('photo reservations validate MIME/size and a removal verifies database absence after a lost Storage response',async()=>{
 assert.ok((await actions.bookPhotoAction(form({operation:'reserve_photo',pageId:id(4),contentType:'text/html',byteSize:'12'}))).error);assert.deepEqual(backend.calls,[]);
 const path=`${id(1)}/${id(4)}/${id(3)}.jpg`;backend.configure({result:{id:id(3),object_path:path,status:'pending'}});
 const reserved=await actions.bookPhotoAction(form({operation:'reserve_photo',pageId:id(4),contentType:'image/jpeg',byteSize:'12'}));assert.equal(reserved.reservation.photo_id,id(3));assert.equal(reserved.reservation.status,'pending');
 backend.configure({result:{object_path:path},storageThrow:true});const removed=await actions.bookPhotoAction(form({operation:'remove_photo',pageId:id(4),confirm:'delete'}));assert.equal(removed.saved,true);assert.deepEqual(backend.calls.map(c=>c.name??'storage'),['mutate_memory_book','storage','mutate_memory_book']);assert.equal(backend.calls[2].args.p_operation,'finish_remove_photo');
 backend.configure({result:{object_path:`${id(99)}/${id(4)}/${id(3)}.jpg`}});assert.ok((await actions.bookPhotoAction(form({operation:'remove_photo',pageId:id(4),confirm:'delete'}))).error);assert.equal(backend.calls.length,1);
});
test('open before completion redirects to the same book only after a successful authenticated RPC',async()=>{
 await assert.rejects(actions.openBookAction({error:null},form({outingId:id(9),next:'https://evil.invalid'})),e=>e.location===`/app/groups/${id(1)}/memories/${id(1)}`);
 assert.deepEqual(backend.calls[0],{name:'open_memory_book',args:{p_group:id(1),p_outing:id(9)}});
});
