import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {beforeEach,test} from "node:test";
const moduleURL=source=>`data:text/javascript,${encodeURIComponent(source)}`;
const envURL=moduleURL("export let hasEnvVars=true;export function configure(value){hasEnvVars=value;}");
const providerURL=moduleURL(`
export const calls=[];let signedIn=true,error=null,throws=false;
export function configure(session=true,problem=null,shouldThrow=false){signedIn=session;error=problem;throws=shouldThrow;calls.length=0;}
export async function createClient(){return {auth:{getClaims:async()=>({data:signedIn?{claims:{sub:'verified-actor'}}:null,error:null})},
rpc:async(name,input)=>{calls.push({name,input});if(throws)throw new Error('private transport data');return {data:error?null:(name==='update_item'?input.p_item_id:input.p_request_id),error};}};}
`);
const cacheURL=moduleURL("export const paths=[];export function revalidatePath(path){paths.push(path);}");
registerHooks({resolve(specifier,context,next){
  const urls={"@/lib/utils":envURL,"@/lib/supabase/server":providerURL,"next/cache":cacheURL};
  if(urls[specifier])return {url:urls[specifier],shortCircuit:true};
  if(specifier.startsWith("@/lib/"))return {url:new URL(`../${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
const {updateItemAction}=await import("../app/app/groups/[groupId]/items/edit-actions.ts");
const {createCommentAction}=await import("../app/app/groups/[groupId]/items/comment-actions.ts");
const {parseItemEdit}=await import("../lib/items/edit.ts");
const {parseComment,getComments}=await import("../lib/items/comments.ts");
const provider=await import(providerURL),env=await import(envURL),cache=await import(cacheURL);
const groupId="10000000-0000-4000-8000-000000000001",itemId="20000000-0000-4000-8000-000000000001",requestId="30000000-0000-4000-8000-000000000001";
const initial={error:null};
function form(values={}){const result=new FormData();for(const [key,value] of Object.entries({groupId,itemId,requestId,title:" カフェ改 ",memo:" メモ ",expectedTitle:"カフェ",expectedMemo:"",body:" コメント ",...values}))if(value!==null)result.set(key,value);return result;}
beforeEach(()=>{provider.configure();env.configure(true);cache.paths.length=0;});
test("edit and comment input validate Unicode bounds, original snapshots and file submissions",()=>{
  assert.equal(parseItemEdit(form()).title,"カフェ改");assert.equal(parseItemEdit(form()).expectedTitle,"カフェ");
  assert.equal(parseComment(form({body:"🌸".repeat(2000)})).body.length,4000);
  for(const values of [{title:"　"},{memo:"x".repeat(2001)},{expectedTitle:new File(["x"],"x")},{expectedMemo:null},{itemId:"bad"},{groupId:"bad"}])assert.throws(()=>parseItemEdit(form(values)));
  for(const values of [{body:"　"},{body:"🌸".repeat(2001)},{body:new File(["x"],"x")},{requestId:null},{itemId:"bad"}])assert.throws(()=>parseComment(form(values)));
});
test("invalid and signed-out submissions never reach a write RPC or invalidate caches",async()=>{
  assert.ok((await updateItemAction(initial,form({title:" "}))).error);
  assert.ok((await createCommentAction(initial,form({body:" "}))).error);
  provider.configure(false);
  assert.ok((await updateItemAction(initial,form())).error);assert.ok((await createCommentAction(initial,form())).error);
  provider.configure();env.configure(false);
  assert.ok((await updateItemAction(initial,form())).error);assert.ok((await createCommentAction(initial,form())).error);
  assert.deepEqual(provider.calls,[]);assert.deepEqual(cache.paths,[]);
});
test("edit ignores forged creator and kind, checks snapshot and refreshes list/detail on success",async()=>{
  const result=await updateItemAction(initial,form({created_by:"forged",userId:"forged",kind:"activity"}));
  assert.deepEqual(result,{error:null,saved:{title:"カフェ改",memo:"メモ"}});
  assert.deepEqual(provider.calls,[{name:"update_item",input:{p_group_id:groupId,p_item_id:itemId,p_title:"カフェ改",p_memo:"メモ",p_expected_title:"カフェ",p_expected_memo:""}}]);
  assert.deepEqual(cache.paths,[`/app/groups/${groupId}/items`,`/app/groups/${groupId}/items/${itemId}`]);
});
test("conflicts and missing migrations never report a successful edit or expose raw errors",async()=>{
  for(const code of ["40001","42501","PGRST202","XX000"]){
    provider.configure(true,{code,message:"private database data"});
    const result=await updateItemAction(initial,form());assert.ok(result.error);assert.equal(result.saved,undefined);assert.ok(!result.error.includes("private"));
    if(code==="40001")assert.match(result.error,/変更されています/);
  }
  provider.configure(true,null,true);assert.ok(!(await updateItemAction(initial,form())).error.includes("private"));assert.deepEqual(cache.paths,[]);
});
test("comments derive the actor, reuse the request ID for saving and rotate only after success",async()=>{
  const result=await createCommentAction(initial,form({created_by:"forged",userId:"forged"}));
  assert.equal(result.error,null);assert.match(result.nextRequestId,/^[0-9a-f-]{36}$/);assert.notEqual(result.nextRequestId,requestId);
  assert.deepEqual(provider.calls,[{name:"create_item_comment",input:{p_group_id:groupId,p_item_id:itemId,p_body:"コメント",p_request_id:requestId}}]);
  assert.deepEqual(cache.paths,[`/app/groups/${groupId}/items/${itemId}`]);
});
test("comment failures preserve the request ID and never invalidate as if successful",async()=>{
  for(const code of ["23505","42501","PGRST202","XX000"]){
    provider.configure(true,{code,message:"private database data"});
    const result=await createCommentAction(initial,form());assert.ok(result.error);assert.equal(result.nextRequestId,undefined);assert.ok(!result.error.includes("private"));
  }
  provider.configure(true,null,true);assert.ok(!(await createCommentAction(initial,form())).error.includes("private"));assert.deepEqual(cache.paths,[]);
});
test("comment reads send the scoped page and remove unrequested data before returning to the UI",async()=>{
  const row={id:requestId,body:"hello",is_mine:false,created_at:"2026-10-18T00:00:00Z",created_by:"private-actor",email:"private-email"};
  const client={rpc:async(name,input)=>{assert.equal(name,"get_item_comments");assert.deepEqual(input,{p_group_id:groupId,p_item_id:itemId,p_page:2});return {data:[{comments:[row],total_count:21}],error:null};}};
  assert.deepEqual(await getComments(client,groupId,itemId,2),{comments:[{id:requestId,body:"hello",is_mine:false,created_at:"2026-10-18T00:00:00Z"}],total:21});
});
test("malformed and unavailable comment responses are errors rather than empty successes",async()=>{
  for(const data of [null,[],[{comments:[],total_count:-1}],[{comments:[],total_count:"1"}],[{comments:[{id:requestId,body:"hello",is_mine:"false",created_at:"bad"}],total_count:1}]])await assert.rejects(getComments({rpc:async()=>({data,error:null})},groupId,itemId,1));
  await assert.rejects(getComments({rpc:async()=>({data:null,error:{code:"PGRST202",message:"private"}})},groupId,itemId,1),error=>error.message.includes("準備中")&&!error.message.includes("private"));
});
