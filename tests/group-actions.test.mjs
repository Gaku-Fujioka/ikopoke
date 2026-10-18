import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";
import { parseGroupInput } from "../lib/groups/validation.ts";

const asModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const envModule = asModule("export let hasEnvVars = true; export function configure(value) { hasEnvVars = value; }");
const providerModule = asModule(`
  export const calls = [];
  let signedIn = true, rpcError = null;
  export function configure(session, error = null) { signedIn = session; rpcError = error; calls.length = 0; }
  export async function createClient() { return {
    auth: {getClaims: async () => ({data: signedIn ? {claims:{sub:'verified-user'}} : null, error:null})},
    rpc: async (name, input) => { calls.push({name,input}); return {data:rpcError ? null : input.p_request_id, error:rpcError}; },
  }; }
`);
const navigationModule = asModule("export function redirect(location) {const error = new Error('test redirect'); error.location = location; throw error;}");
const cacheModule = asModule("export const paths = []; export function revalidatePath(path) { paths.push(path); }");
registerHooks({resolve(specifier, context, next) {
  const url = {
    "@/lib/utils": envModule,
    "@/lib/supabase/server": providerModule,
    "@/lib/groups/repository": new URL("../lib/groups/repository.ts", import.meta.url).href,
    "@/lib/groups/validation": new URL("../lib/groups/validation.ts", import.meta.url).href,
    "@/lib/presentation/repository": new URL("../lib/presentation/repository.ts", import.meta.url).href,
    "@/lib/presentation/colors": new URL("../lib/presentation/colors.ts", import.meta.url).href,
    "next/navigation": navigationModule,
    "next/cache": cacheModule,
  }[specifier];
  return url ? {url,shortCircuit:true} : next(specifier,context);
}});
const env = await import(envModule);
const provider = await import(providerModule);
const cache = await import(cacheModule);
const {createGroupAction,createGroupProfileAction} = await import("../app/app/groups/actions.ts");
const requestId = "10000000-0000-4000-8000-000000000001";
const initial = {error:null};
function form(name = "  週末  ", id = requestId) {
  const data = new FormData(); data.set("name",name); data.set("requestId",id); return data;
}
beforeEach(() => {env.configure(true); provider.configure(true); cache.paths.length = 0;});

test("group names reject whitespace and enforce a Unicode character limit", () => {
  for (const name of ["", "　\n\t", null, "x".repeat(81)]) assert.throws(() => parseGroupInput(name,requestId));
  assert.equal(parseGroupInput("😀".repeat(80),requestId).name.length,160);
  assert.throws(() => parseGroupInput("valid","not-a-uuid"));
});

test("unconfigured and signed-out requests never call the group creation RPC", async () => {
  env.configure(false);
  assert.ok((await createGroupAction(initial,form())).error);
  env.configure(true); provider.configure(false);
  assert.equal((await createGroupAction(initial,form())).error,"ログインし直して、もう一度お試しください。");
  assert.equal(provider.calls.length,0);
});

test("invalid form input does not reach the provider", async () => {
  assert.equal((await createGroupAction(initial,form("　"))).error,"グループの名前を入力してください。");
  assert.equal(provider.calls.length,0);
});

test("creation uses the session identity and preserves the request ID for retries", async () => {
  const data = form(); data.set("userId","forged-user");
  await assert.rejects(createGroupAction(initial,data),(error)=>error.location === `/app/groups/${requestId}`);
  assert.deepEqual(provider.calls,[{name:"create_group",input:{p_name:"週末",p_request_id:requestId}}]);
  assert.deepEqual(cache.paths,["/app/groups","/app"]);
});

test("a database failure stays on the form without a success redirect or raw details", async () => {
  provider.configure(true,{code:"42501",message:"private-provider-detail"});
  const result = await createGroupAction(initial,form());
  assert.ok(result.error); assert.ok(!result.error.includes("private-provider-detail"));
  assert.deepEqual(cache.paths,[]);
});

test("missing migrations are shown as unavailable rather than an empty saved list", async () => {
  provider.configure(true,{code:"PGRST202"});
  assert.equal((await createGroupAction(initial,form())).error,"グループ機能は準備中です。利用できるようになるまでお待ちください。");
});

test("group profile creation keeps optional description in the same RPC and ignores forged identities",async()=>{
  const data=form();data.set('description','  みんなの週末\n次は海へ  ');data.set('created_by','forged-user');
  assert.deepEqual(await createGroupProfileAction(data),{error:null,groupId:requestId});
  assert.deepEqual(provider.calls,[{name:'create_group_with_profile',input:{p_name:'週末',p_request_id:requestId,p_description:'みんなの週末\n次は海へ'}}]);
  assert.deepEqual(cache.paths,['/app/groups','/app']);
});
test("new group optional fields may be empty, but invalid descriptions and signed-out requests do not persist",async()=>{
  assert.equal((await createGroupProfileAction(form())).groupId,requestId);
  provider.configure(true);cache.paths.length=0;
  const data=form();data.set('description','😀'.repeat(501));assert.ok((await createGroupProfileAction(data)).error);assert.deepEqual(provider.calls,[]);
  data.set('description','説明');provider.configure(false);assert.ok((await createGroupProfileAction(data)).error);assert.deepEqual(provider.calls,[]);assert.deepEqual(cache.paths,[]);
});
test("new group storage errors never return a group ID, redirect or invalidate",async()=>{
  provider.configure(true,{code:'42501',message:'private-provider-detail'});
  const result=await createGroupProfileAction(form());assert.ok(result.error);assert.ok(!result.groupId);assert.ok(!result.error.includes('private'));assert.deepEqual(cache.paths,[]);
});
