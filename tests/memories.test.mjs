import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {beforeEach,test} from "node:test";
const moduleURL=source=>`data:text/javascript,${encodeURIComponent(source)}`;
const providerURL=moduleURL(`
let plan={};export const calls=[];export function configure(value){plan=value;calls.length=0;}
export async function createClient(){calls.push(['client']);return {auth:{getClaims:async()=>({data:plan.signedOut?null:{claims:{sub:'session-actor'}},error:null})},rpc:async(name,args)=>{calls.push(['rpc',name,args]);return plan.reply??{data:'60000000-0000-4000-8000-000000000001',error:null};}};}
export function revalidatePath(...args){calls.push(['revalidate',...args]);}
export function redirect(path){const error=new Error('redirect');error.location=path;throw error;}
`);
registerHooks({resolve(specifier,context,next){
  if(["@/lib/supabase/server","next/cache","next/navigation"].includes(specifier))return {url:providerURL,shortCircuit:true};
  if(specifier==="@/lib/utils")return {url:moduleURL("export const hasEnvVars=true;"),shortCircuit:true};
  if(specifier.startsWith("@/"))return {url:new URL(`../${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};
  if(specifier.startsWith(".")&&!/\.[a-z]+$/.test(specifier))return {url:new URL(`${specifier}.ts`,context.parentURL).href,shortCircuit:true};
  return next(specifier,context);
}});
const {orderMemoryVisits}=await import("../lib/memories/order.ts");
const {visitTimeLabel}=await import("../lib/visits/time.ts");
const {recordVisitInput}=await import("../lib/visits/validation.ts");
const {memoryContext,memoryFields}=await import("../lib/memories/validation.ts");
const actions=await import("../app/app/groups/[groupId]/memories/actions.ts"),provider=await import(providerURL);
const group="10000000-0000-4000-8000-000000000001",plan="30000000-0000-4000-8000-000000000001",memory="60000000-0000-4000-8000-000000000001";
function form(overrides={}){const result=new FormData();for(const [key,value]of Object.entries({groupId:group,id:plan,revision:"1",completed:"true",title:"一冊",note:"あとがき",...overrides}))result.set(key,value);return result;}
beforeEach(()=>provider.configure({}));
test("album ordering uses date then exact/period time, plan order and stable creation/ID ties",()=>{
  const visit=(id,date,time,period,item="a",created="2026-10-18T00:00:00Z")=>({id,item_id:item,visited_on:date,visited_time:time,visited_period:period,created_at:created});
  const entries=[visit("none","2026-10-18",null,null),visit("late","2026-10-18","19:30:00",null),visit("period","2026-10-18",null,"afternoon"),visit("early","2026-10-17",null,null),visit("noon","2026-10-18",null,"noon"),visit("exact","2026-10-18","12:30:00",null),visit("morning","2026-10-18",null,"morning")];
  assert.deepEqual(orderMemoryVisits(entries,[]).map(v=>v.id),["early","morning","noon","exact","period","late","none"]);
  assert.equal(entries[0].id,"none");
  const ties=[visit("removed","2026-10-18",null,null,"gone"),visit("b","2026-10-18",null,null,"b"),visit("a2","2026-10-18",null,null,"a"),visit("a1","2026-10-18",null,null,"a")];
  assert.deepEqual(orderMemoryVisits(ties,[{item_id:"a",position:0},{item_id:"b",position:1}]).map(v=>v.id),["a1","a2","b","removed"]);
  assert.equal(visitTimeLabel(entries[1]),"19:30");assert.equal(visitTimeLabel(entries[2]),"午後");
});
test("optional time, mutually exclusive period and memory limits reject invalid submissions",()=>{
  const visitForm=form({visitId:"40000000-0000-4000-8000-000000000001",itemId:"20000000-0000-4000-8000-000000000001",date:"2026-10-18",rating:"",outingId:"",time:"09:35",period:""});
  assert.equal(recordVisitInput(visitForm).time,"09:35");visitForm.set("period","morning");assert.throws(()=>recordVisitInput(visitForm),/どちらか/);visitForm.set("time","24:00");assert.throws(()=>recordVisitInput(visitForm),/時刻/);
  assert.throws(()=>memoryContext(form({revision:"0"})),/開き直して/);assert.throws(()=>memoryFields(form({title:"　"})),/タイトル/);assert.throws(()=>memoryFields(form({note:"あ".repeat(2001)})),/2,000/);assert.equal(memoryFields(form({title:"旅".repeat(120)})).title.length,120);
});
test("invalid completion or signed-out calls never mutate, failures hide provider details",async()=>{
  assert.ok((await actions.setOutingCompletedAction({error:null},form({completed:"other"}))).error);assert.deepEqual(provider.calls,[]);
  provider.configure({signedOut:true});assert.ok((await actions.setOutingCompletedAction({error:null},form())).error);assert.equal(provider.calls.some(c=>c[0]==="rpc"),false);
  provider.configure({reply:{data:null,error:{code:"40001",message:"private-detail"}}});const result=await actions.setOutingCompletedAction({error:null},form());assert.match(result.error,/別の画面/);assert.ok(!result.error.includes("private"));assert.equal(provider.calls.some(c=>c[0]==="revalidate"),false);
});
test("completion redirects to the one album, undo to its plan, and both revalidate",async()=>{
  await assert.rejects(actions.setOutingCompletedAction({error:null},form({userId:"spoofed"})),e=>e.location===`/app/groups/${group}/memories/${memory}`);
  assert.deepEqual(provider.calls.find(c=>c[0]==="rpc").slice(1),["set_outing_completed",{p_group_id:group,p_outing_id:plan,p_completed:true,p_expected_revision:1}]);assert.ok(provider.calls.some(c=>c[0]==="revalidate"&&c[1].endsWith(`/memories/${memory}`)));
  provider.configure({});await assert.rejects(actions.setOutingCompletedAction({error:null},form({completed:"false"})),e=>e.location===`/app/groups/${group}/outings/${plan}`);
});
test("album editing returns the saved revision and only revalidates successful writes",async()=>{
  provider.configure({reply:{data:2,error:null}});const result=await actions.updateMemoryAction({error:null},form({id:memory}));assert.equal(result.savedRevision,2);assert.equal(result.savedTitle,"一冊");assert.equal(result.savedNote,"あとがき");
  provider.configure({reply:{data:null,error:{code:"40001",message:"private"}}});assert.ok((await actions.updateMemoryAction({error:null},form({id:memory}))).error);assert.equal(provider.calls.some(c=>c[0]==="revalidate"),false);
});
test("album repository scopes every read and keeps more than 1000 visit rows",async()=>{
  const {getMemoryContent,listMemories,getMemory}=await import("../lib/memories/repository.ts");const calls=[];
  const client={from:table=>{let start=0;const query={select:(...args)=>{calls.push([table,"select",...args]);return query;},eq:(...args)=>{calls.push([table,"eq",...args]);return query;},in:(...args)=>{calls.push([table,"in",...args]);return query;},order:()=>query,range:(a,b)=>{start=a;calls.push([table,"range",a,b]);if(table==="visits")return Promise.resolve({data:Array.from({length:start===0?1000:1},(_,n)=>({id:`visit-${start+n}`})),error:null});return Promise.resolve({data:[],error:null,count:0});},maybeSingle:async()=>({data:null,error:null})};return query;}};
  const result=await getMemoryContent(client,{group_id:group,outing_id:plan});assert.equal(result.visits.length,1001);assert.ok(calls.some(c=>c[0]==="visits"&&c[1]==="range"&&c[2]===1000));assert.equal(calls.filter(c=>c[0]==="visit_photos"&&c[1]==="in").length,11);assert.ok(calls.some(c=>c[0]==="visits"&&c[1]==="eq"&&c[2]==="outing_id"&&c[3]===plan));
  await listMemories(client,group,2);await getMemory(client,group,memory);assert.ok(calls.filter(c=>c[1]==="eq"&&c[2]==="group_id").every(c=>c[3]===group));assert.ok(calls.some(c=>c[0]==="memories"&&c[1]==="range"&&c[2]===20&&c[3]===39));
});
