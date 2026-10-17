import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {registerHooks} from "node:module";
import {after,before,test} from "node:test";
const moduleURL=source=>`data:text/javascript,${encodeURIComponent(source)}`;
const envURL=moduleURL("export const hasEnvVars=true;");
const providerURL=moduleURL(`export const calls=[];let code=null,signedIn=true;export function configure(error=null,session=true){code=error;signedIn=session;calls.length=0;}
export async function createClient(){return {auth:{getClaims:async()=>({data:signedIn?{claims:{sub:'verified'}}:null,error:null})},rpc:async(name,input)=>{calls.push({name,input});return {data:code?null:input.p_group_id,error:code?{code,message:'private'}:null};}};}`);
const cacheURL=moduleURL("export const paths=[];export function revalidatePath(path,type){paths.push({path,type});}");
registerHooks({resolve(specifier,context,next){
  const url={"@/lib/utils":envURL,"@/lib/supabase/server":providerURL,"next/cache":cacheURL}[specifier];
  if(url)return {url,shortCircuit:true};
  if(specifier.startsWith("@/lib/"))return {url:new URL(`../${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
const {renameGroupAction}=await import("../app/app/groups/rename-actions.ts");
const provider=await import(providerURL),cache=await import(cacheURL);
const {PGlite}=await import(process.env.KOKOIKO_PGLITE_MODULE_URL??"@electric-sql/pglite");
let db;
const alice="00000000-0000-4000-8000-000000000001",bob="00000000-0000-4000-8000-000000000002",outsider="00000000-0000-4000-8000-000000000003",group="10000000-0000-4000-8000-000000000001";
before(async()=>{
  db=await PGlite.create();await db.exec(`create role anon nologin;create role authenticated nologin;
  create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated;insert into auth.users(id) values('${alice}'),('${bob}'),('${outsider}');`);
  for(const file of ["20261017091513_create_groups.sql","20261018013000_rename_groups.sql"])await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
  await asUser(alice,()=>db.query("select public.create_group('元の名前',$1)",[group]));
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)",[group,bob]);
});
after(async()=>{await db?.close();});
async function asUser(user,work,role="authenticated"){
  await db.exec(`set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??""]);
  try{return await work();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','','false')");}
}
const fails=(work,code)=>assert.rejects(work,error=>error.code===code);
const rename=(name="新しい名前",expected="元の名前",id=group)=>db.query("select public.rename_group($1,$2,$3)",[id,name,expected]);
function form(values={}){const result=new FormData();for(const [key,value] of Object.entries({groupId:group,name:" 新しい名前 ",expectedName:"元の名前",...values}))if(value!==null)result.set(key,value);return result;}
test("anonymous users, missing identity and non-members cannot rename",async()=>{
  await asUser(null,()=>fails(rename(),"42501"),"anon");await asUser(null,()=>fails(rename(),"28000"));await asUser(outsider,()=>fails(rename(),"42501"));
});
test("every member can rename without changing creation metadata; stale saves are rejected",async()=>{
  const before=(await db.query("select * from public.groups where id=$1",[group])).rows[0];
  await asUser(bob,()=>rename("　新しい名前 "));await asUser(bob,()=>rename());
  await asUser(alice,()=>fails(rename("上書き"),"40001"));
  assert.deepEqual((await db.query("select * from public.groups where id=$1",[group])).rows[0],{...before,name:"新しい名前"});
  await asUser(bob,()=>fails(db.query("update public.groups set name='直接変更' where id=$1",[group]),"42501"));
});
test("SQL rejects blank, long and null input and respects Unicode character counts",async()=>{
  for(const [name,expected] of [[null,"新しい名前"],["　\t\uFEFF","新しい名前"],["😀".repeat(81),"新しい名前"],["有効",null]])await asUser(alice,()=>fails(rename(name,expected),"22023"));
  await asUser(alice,()=>rename("😀".repeat(80),"新しい名前"));
});
test("rename Action validates inputs before RPC, ignores actor fields and refreshes dependent screens",async()=>{
  provider.configure();cache.paths.length=0;
  for(const values of [{name:"　"},{name:"x".repeat(81)},{name:new File(["x"],"x")},{expectedName:null},{groupId:"bad"}])assert.ok((await renameGroupAction({error:null},form(values))).error);
  assert.deepEqual(provider.calls,[]);
  assert.deepEqual(await renameGroupAction({error:null},form({userId:"forged"})),{error:null,savedName:"新しい名前"});
  assert.deepEqual(provider.calls,[{name:"rename_group",input:{p_group_id:group,p_name:"新しい名前",p_expected_name:"元の名前"}}]);
  assert.equal(cache.paths.length,4);assert.deepEqual(cache.paths.at(-1),{path:`/app/groups/${group}/items/[itemId]`,type:"page"});
});
test("signed-out submissions and failed renames never return success or raw provider details",async()=>{
  provider.configure(null,false);cache.paths.length=0;assert.ok((await renameGroupAction({error:null},form())).error);assert.deepEqual(provider.calls,[]);
  for(const code of ["40001","42501","PGRST202","XX000"]){provider.configure(code);const result=await renameGroupAction({error:null},form());assert.ok(result.error);assert.equal(result.savedName,undefined);assert.ok(!result.error.includes("private"));}
  assert.deepEqual(cache.paths,[]);
});
test("membership removal also denies harmless-looking rename retries",async()=>{
  await db.query("delete from public.group_members where group_id=$1 and user_id=$2",[group,alice]);
  await asUser(alice,()=>fails(rename("😀".repeat(80),"新しい名前"),"42501"));
});
