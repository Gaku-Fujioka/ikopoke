import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {beforeEach,test} from "node:test";
import {photoFileInput,recordVisitInput,PHOTO_BYTES_LIMIT} from "../lib/visits/validation.ts";
import {transferVisitPhoto} from "../lib/visits/photo-transfer.ts";
const moduleURL=source=>`data:text/javascript,${encodeURIComponent(source)}`;
const providerURL=moduleURL(`
let plan={};export const calls=[];export function configure(value){plan=value;calls.length=0;}
export async function createClient(){calls.push(['client']);return {
 auth:{getClaims:async()=>({data:plan.signedOut?null:{claims:{sub:'session-user'}},error:null})},
 rpc:async(name,args)=>{calls.push(['rpc',name,args]);return plan.rpc?plan.rpc(name,args):{data:'saved-id',error:null};},
 from:table=>{const chain={select:(...args)=>{calls.push(['select',table,...args]);return chain;},eq:(...args)=>{calls.push(['eq',...args]);return chain;},maybeSingle:async()=>({data:plan.photo??null,error:plan.readError??null})};return chain;},
 storage:{from:bucket=>({remove:async paths=>{calls.push(['remove',bucket,paths]);return {data:[],error:plan.removeError??null};},download:async path=>{calls.push(['download',bucket,path]);return {data:plan.file??new Blob(['image']),error:plan.downloadError??null};}})}
};}
export function revalidatePath(...args){calls.push(['revalidate',...args]);}
export function redirect(path){const error=new Error('redirect');error.location=path;throw error;}
`);
registerHooks({resolve(specifier,context,next){
  if(["@/lib/supabase/server","next/cache","next/navigation"].includes(specifier))return {url:providerURL,shortCircuit:true};
  if(specifier==="@/lib/utils")return {url:moduleURL("export const hasEnvVars=true;"),shortCircuit:true};
  if(specifier.startsWith("@/"))return {url:new URL(`../${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
const actions=await import("../app/app/groups/[groupId]/visits/actions.ts");
const provider=await import(providerURL);
const group="10000000-0000-4000-8000-000000000001",item="20000000-0000-4000-8000-000000000001",visit="40000000-0000-4000-8000-000000000001",photo="50000000-0000-4000-8000-000000000001";
function form(overrides={}){const result=new FormData();for(const [key,value] of Object.entries({groupId:group,itemId:item,outingId:"",visitId:visit,photoId:photo,date:"2026-10-18",note:"記録",rating:"",revision:"1",contentType:"image/jpeg",byteSize:"12",...overrides}))result.set(key,value);return result;}
beforeEach(()=>provider.configure({}));
test("visit and file validation reject malformed dates, ratings, sizes and unsafe image types",()=>{
  assert.throws(()=>recordVisitInput(form({date:"2026-02-30"})),/訪問日/);
  assert.throws(()=>recordVisitInput(form({rating:"6"})),/評価/);
  assert.equal(recordVisitInput(form()).rating,null);
  assert.equal(photoFileInput("image/jpeg",PHOTO_BYTES_LIMIT).byteSize,PHOTO_BYTES_LIMIT);
  assert.throws(()=>photoFileInput("image/jpeg",PHOTO_BYTES_LIMIT+1),/10MB/);
  assert.throws(()=>photoFileInput("image/svg+xml",12),/JPEG/);
});
test("invalid or signed-out submissions never mutate the provider",async()=>{
  assert.ok((await actions.recordVisitAction({error:null},form({date:"bad"}))).error);assert.deepEqual(provider.calls,[]);
  provider.configure({signedOut:true});assert.ok((await actions.recordVisitAction({error:null},form())).error);assert.equal(provider.calls.some(call=>call[0]==="rpc"),false);
});
test("record creation derives actor in the DB, preserves the request and redirects only on success",async()=>{
  await assert.rejects(actions.recordVisitAction({error:null},form({userId:"spoofed"})),error=>error.location===`/app/groups/${group}/visits/saved-id`);
  const call=provider.calls.find(call=>call[0]==="rpc");assert.equal(call[1],"record_timed_visit");assert.equal(call[2].p_request_id,visit);assert.equal(call[2].p_outing_id,null);assert.ok(!JSON.stringify(call).includes("spoofed"));
  provider.configure({rpc:()=>({data:null,error:{code:"40001",message:"private provider detail"}})});
  const result=await actions.updateVisitAction({error:null},form());assert.match(result.error,/別の画面/);assert.ok(!result.error.includes("private"));assert.equal(provider.calls.some(call=>call[0]==="revalidate"),false);
});
test("photo cancellation removes actual object through Storage before releasing the reservation",async()=>{
  provider.configure({rpc:name=>({data:name==="begin_cancel_visit_photo"?"reserved/path.jpg":null,error:null})});
  assert.equal((await actions.cancelPhotoAction(form())).saved,true);
  assert.deepEqual(provider.calls.filter(call=>["rpc","remove"].includes(call[0])).map(call=>call[0]==="rpc"?call[1]:call[0]),["begin_cancel_visit_photo","remove","cancel_visit_photo"]);
  provider.configure({rpc:name=>name==="cancel_visit_photo"?{data:null,error:{code:"22023"}}:{data:"reserved/path.jpg",error:null},removeError:{message:"private detail"}});
  const result=await actions.cancelPhotoAction(form());assert.ok(result.error);assert.ok(!result.error.includes("private"));assert.ok(provider.calls.some(call=>call[1]==="cancel_visit_photo"));assert.ok(provider.calls.some(call=>call[0]==="revalidate"));
  provider.configure({rpc:name=>({data:name==="begin_cancel_visit_photo"?"reserved/path.jpg":null,error:null}),removeError:{message:"not found"}});
  assert.equal((await actions.cancelPhotoAction(form())).saved,true);
});
test("photo completion failures never claim success or expose provider details",async()=>{
  provider.configure({rpc:()=>({data:null,error:{code:"22023",message:"private"}})});
  const result=await actions.finishPhotoAction(form());assert.ok(result.error);assert.equal(result.saved,undefined);assert.ok(!result.error.includes("private"));
  provider.configure({});assert.ok((await actions.reservePhotoAction(form({byteSize:String(PHOTO_BYTES_LIMIT+1)}))).error);assert.deepEqual(provider.calls,[]);
});
test("lost upload responses are independently finalized; a failed finalization never claims success",async()=>{
  const calls=[];
  const reserve=async()=>({error:null,reservation:{photo_id:photo,object_path:"reserved/path.jpg",status:"pending"}});
  await transferVisitPhoto({reserve,upload:async path=>{calls.push(path);throw new Error("lost response");},finish:async()=>{calls.push("finish");return {error:null};}});
  assert.deepEqual(calls,["reserved/path.jpg","finish"]);
  await assert.rejects(transferVisitPhoto({reserve,upload:async()=>({error:"failed"}),finish:async()=>({error:"未完了"})}),/未完了/);
});
test("retrying a ready reservation does not upload again and cancelling reservations reject uploads",async()=>{
  let uploaded=false;
  const steps={upload:async()=>{uploaded=true;},finish:async()=>({error:null})};
  await transferVisitPhoto({...steps,reserve:async()=>({error:null,reservation:{photo_id:photo,object_path:"path",status:"ready"}})});
  assert.equal(uploaded,false);
  await assert.rejects(transferVisitPhoto({...steps,reserve:async()=>({error:null,reservation:{photo_id:photo,object_path:"path",status:"cancelling"}})}),/中断/);
  assert.equal(uploaded,false);
});
