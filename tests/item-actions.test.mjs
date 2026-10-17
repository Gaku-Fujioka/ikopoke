import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";

const asModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const envModule = asModule("export let hasEnvVars=true; export function configure(value){hasEnvVars=value;}");
const providerModule = asModule(`
  export const calls=[];
  let signedIn=true, rpcError=null, throws=false;
  export function configure(session,error=null,shouldThrow=false){signedIn=session;rpcError=error;throws=shouldThrow;calls.length=0;}
  export async function createClient(){return {
    auth:{getClaims:async()=>({data:signedIn?{claims:{sub:'verified-user'}}:null,error:null})},
    rpc:async(name,input)=>{calls.push({name,input});if(throws)throw new Error('private-network-detail');return {data:rpcError?null:input.p_request_id,error:rpcError};},
  };}
`);
const navigationModule = asModule("export function redirect(location){const error=new Error('redirect');error.location=location;throw error;}");
const cacheModule = asModule("export const paths=[]; export function revalidatePath(path){paths.push(path);}");
registerHooks({resolve(specifier,context,next){
  const url={
    "@/lib/utils":envModule,"@/lib/supabase/server":providerModule,
    "@/lib/groups/validation":new URL("../lib/groups/validation.ts",import.meta.url).href,
    "@/lib/items/validation":new URL("../lib/items/validation.ts",import.meta.url).href,
    "@/lib/items/repository":new URL("../lib/items/repository.ts",import.meta.url).href,
    "next/navigation":navigationModule,"next/cache":cacheModule,
  }[specifier];
  return url?{url,shortCircuit:true}:next(specifier,context);
}});
const {parseItemInput,itemPage} = await import("../lib/items/validation.ts");
const {createItemAction} = await import("../app/app/groups/[groupId]/items/actions.ts");
const env=await import(envModule), provider=await import(providerModule), cache=await import(cacheModule);
const groupId="10000000-0000-4000-8000-000000000001", requestId="20000000-0000-4000-8000-000000000001";
const initial={error:null};
function form(overrides={}){
  const input=new FormData();
  for(const [key,value] of Object.entries({groupId,requestId,title:"　カフェ ",kind:"spot",memo:" 海を見たい ",...overrides})) if(value!==null)input.set(key,value);
  return input;
}
beforeEach(()=>{env.configure(true);provider.configure(true);cache.paths.length=0;});

test("input trims values, accepts optional memo and counts Unicode characters",()=>{
  assert.deepEqual(parseItemInput(form()),{groupId,requestId,title:"カフェ",kind:"spot",memo:"海を見たい"});
  assert.equal(parseItemInput(form({title:"😀".repeat(100),memo:"🌸".repeat(2000)})).title.length,200);
  assert.equal(parseItemInput(form({memo:null})).memo,"");
});

test("validation identifies the invalid field and rejects files and tampered IDs",()=>{
  for(const [overrides,field] of [[{title:"　\t\n"},"title"],[{title:"x".repeat(101)},"title"],[{kind:"invalid"},"kind"],[{memo:"x".repeat(2001)},"memo"],[{memo:new File(["x"],"memo.txt")},"memo"]]) {
    assert.throws(()=>parseItemInput(form(overrides)),error=>error.field===field);
  }
  for(const overrides of [{groupId:"elsewhere"},{requestId:"bad"}]) assert.throws(()=>parseItemInput(form(overrides)));
});

test("invalid form input stays on the form and never calls the provider",async()=>{
  const result=await createItemAction(initial,form({title:"　"}));
  assert.equal(result.field,"title");assert.ok(result.error);assert.deepEqual(provider.calls,[]);assert.deepEqual(cache.paths,[]);
});

test("unconfigured and signed-out submissions never save",async()=>{
  env.configure(false);assert.ok((await createItemAction(initial,form())).error);
  env.configure(true);provider.configure(false);
  assert.equal((await createItemAction(initial,form())).error,"ログインし直して、もう一度お試しください。");
  assert.deepEqual(provider.calls,[]);
});

test("creation ignores forged actor fields, passes stable request ID and redirects only on success",async()=>{
  const input=form({userId:"forged",created_by:"forged"});
  await assert.rejects(createItemAction(initial,input),error=>error.location===`/app/groups/${groupId}/items/${requestId}`);
  assert.deepEqual(provider.calls,[{name:"create_item",input:{p_group_id:groupId,p_title:"カフェ",p_kind:"spot",p_memo:"海を見たい",p_request_id:requestId}}]);
  assert.deepEqual(cache.paths,[`/app/groups/${groupId}/items`]);
});

test("DB errors and unexpected failures disclose no raw details or success navigation",async()=>{
  for(const code of ["42501","22023","23505","XX000"]){
    provider.configure(true,{code,message:"private-database-detail"});
    const result=await createItemAction(initial,form());assert.ok(result.error);assert.ok(!result.error.includes("private"));
  }
  provider.configure(true,null,true);
  assert.ok(!(await createItemAction(initial,form())).error.includes("private"));
  assert.deepEqual(cache.paths,[]);
});

test("missing migrations are unavailable rather than a successful empty save",async()=>{
  provider.configure(true,{code:"PGRST202"});
  assert.equal((await createItemAction(initial,form())).error,"候補の共有機能は準備中です。利用できるようになるまでお待ちください。");
  assert.deepEqual(cache.paths,[]);
});

test("page input cannot turn into arbitrary filters or unbounded integer offsets",()=>{
  for(const value of [undefined,["2"],"0","-1","1.5","1 OR true","1000000","Infinity"]) assert.equal(itemPage(value),1);
  assert.equal(itemPage("2"),2);
});
