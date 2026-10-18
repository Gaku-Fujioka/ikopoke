import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach,test } from "node:test";
import { REACTION_OPTIONS,reactionLabel } from "../lib/items/reaction-values.ts";

const asModule=source=>`data:text/javascript,${encodeURIComponent(source)}`;
const envModule=asModule("export let hasEnvVars=true; export function configure(value){hasEnvVars=value;}");
const providerModule=asModule(`
  export const calls=[];
  let signedIn=true,rpcError=null,throws=false;
  export function configure(session,error=null,shouldThrow=false){signedIn=session;rpcError=error;throws=shouldThrow;calls.length=0;}
  export async function createClient(){return {
    auth:{getClaims:async()=>({data:signedIn?{claims:{sub:'verified-user'}}:null,error:null})},
    rpc:async(name,input)=>{calls.push({name,input});if(throws)throw new Error('private-transport');return {data:undefined,error:rpcError};}
  };}
`);
const cacheModule=asModule("export const paths=[];export function revalidatePath(path){paths.push(path);}");
registerHooks({resolve(specifier,context,next){
  const url={
    "@/lib/utils":envModule,"@/lib/supabase/server":providerModule,"next/cache":cacheModule,
    "@/lib/home/revalidate":new URL("../lib/home/revalidate.ts",import.meta.url).href,
    "@/lib/groups/validation":new URL("../lib/groups/validation.ts",import.meta.url).href,
    "@/lib/items/reactions":new URL("../lib/items/reactions.ts",import.meta.url).href,
  }[specifier];
  return url?{url,shortCircuit:true}:next(specifier,context);
}});
const {setReactionAction}=await import("../app/app/groups/[groupId]/items/reaction-actions.ts");
const env=await import(envModule),provider=await import(providerModule),cache=await import(cacheModule);
const groupId="10000000-0000-4000-8000-000000000001",itemId="20000000-0000-4000-8000-000000000001";
function form(overrides={}){
  const input=new FormData();for(const [key,value]of Object.entries({groupId,itemId,reaction:"want_to_go",...overrides}))if(value!==null)input.set(key,value);return input;
}
beforeEach(()=>{env.configure(true);provider.configure(true);cache.paths.length=0;});

test("the approved labels retain existing saved values and distinguish no reaction",()=>{
  assert.deepEqual(REACTION_OPTIONS,[{value:"want_to_go",label:"行きたい！"},{value:"not_now",label:"そこまで"}]);
  assert.equal(reactionLabel(null),"未反応");assert.equal(reactionLabel("not_now"),"そこまで");
});

test("invalid IDs, missing choices and uploaded values never reach the provider",async()=>{
  for(const overrides of [{groupId:"other"},{itemId:"../other"},{reaction:null},{reaction:"invalid"},{reaction:new File(["x"],"value.txt")}]){
    const result=await setReactionAction({error:null},form(overrides));assert.ok(result.error);assert.ok(!result.saved);
  }
  assert.deepEqual(provider.calls,[]);assert.deepEqual(cache.paths,[]);
});

test("unconfigured and signed-out requests cannot save",async()=>{
  env.configure(false);assert.ok((await setReactionAction({error:null},form())).error);
  env.configure(true);provider.configure(false);assert.equal((await setReactionAction({error:null},form())).error,"ログインし直して、もう一度お試しください。");
  assert.deepEqual(provider.calls,[]);assert.deepEqual(cache.paths,[]);
});

test("saving ignores forged user IDs and refreshes the candidate and reaction-filtered list",async()=>{
  const result=await setReactionAction({error:null},form({userId:"forged",user_id:"forged"}));
  assert.deepEqual(result,{error:null,saved:true});
  assert.deepEqual(provider.calls,[{name:"set_item_reaction",input:{p_group_id:groupId,p_item_id:itemId,p_value:"want_to_go"}}]);
  assert.deepEqual(cache.paths,[`/app/groups/${groupId}/items/${itemId}`,`/app/groups/${groupId}/items`,"/app","/app/activity",`/app/groups/${groupId}`,`/app/groups/${groupId}/activity`,"/app/items"]);
});

test("an explicit cancellation is sent as null rather than a toggle",async()=>{
  await setReactionAction({error:null},form({reaction:"clear"}));
  assert.equal(provider.calls[0].input.p_value,null);
});

test("DB rejection and network errors never return success, raw details or revalidation",async()=>{
  for(const code of ["42501","22023","XX000"]){
    provider.configure(true,{code,message:"private-database"});
    const result=await setReactionAction({error:null},form());assert.ok(result.error);assert.ok(!result.error.includes("private"));assert.ok(!result.saved);
  }
  provider.configure(true,null,true);assert.ok(!(await setReactionAction({error:null},form())).error.includes("private"));
  assert.deepEqual(cache.paths,[]);
});

test("unapplied migrations show unavailable rather than successful zero totals",async()=>{
  provider.configure(true,{code:"PGRST202"});
  assert.equal((await setReactionAction({error:null},form())).error,"リアクションは準備中です。利用できるようになるまでお待ちください。");
  assert.deepEqual(cache.paths,[]);
});
