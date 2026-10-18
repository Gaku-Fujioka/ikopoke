import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const envModule = moduleUrl("export let hasEnvVars=true; export function configure(value){hasEnvVars=value;}");
const providerModule = moduleUrl(`
  export const calls=[]; let signedIn=true, code=null;
  export function configure(session=true,error=null){signedIn=session;code=error;calls.length=0;}
  export async function createClient(){return {
    auth:{getClaims:async()=>({data:signedIn?{claims:{sub:'verified-user'}}:null,error:null})},
    rpc:async(name,input)=>{calls.push({name,input});return {error:code?{code,message:'provider-private-data'}:null,data:
      name==='create_group_invite'?[{id:'20000000-0000-4000-8000-000000000001',expires_at:'2026-11-01T00:00:00Z'}]:
      name==='preview_group_invite'?[{group_id:'10000000-0000-4000-8000-000000000001',group_name:'Preview group',expires_at:'2026-11-01T00:00:00Z'}]:
      name==='preview_group_profile'?{group_id:'10000000-0000-4000-8000-000000000001',group_name:'Preview group',description:'共有の紹介',cover_path:null}:input.p_group_id};}
  };}
`);
const cookieModule = moduleUrl(`
  export const values=new Map(), writes=[];
  export function reset(){values.clear();writes.length=0;}
  export async function cookies(){return {get:(name)=>values.has(name)?{value:values.get(name)}:undefined,
    set:(name,value,options)=>{writes.push({name,value,options});values.set(name,value);}};}
`);
const cacheModule = moduleUrl("export const paths=[]; export function revalidatePath(path){paths.push(path);}");
const navigationModule = moduleUrl("export function redirect(location){const error=new Error('redirect');error.location=location;throw error;}");
registerHooks({resolve(specifier,context,next){
  const url={
    '@/lib/utils':envModule,'@/lib/supabase/server':providerModule,
    '@/lib/groups/validation':new URL('../lib/groups/validation.ts',import.meta.url).href,
    '@/lib/groups/invite-cookie':new URL('../lib/groups/invite-cookie.ts',import.meta.url).href,
    '@/lib/groups/invitations':new URL('../lib/groups/invitations.ts',import.meta.url).href,
    'next/headers':cookieModule,'next/cache':cacheModule,'next/navigation':navigationModule,
  }[specifier];return url?{url,shortCircuit:true}:next(specifier,context);
}});
const env=await import(envModule), provider=await import(providerModule), cookie=await import(cookieModule), cache=await import(cacheModule);
const {issueInviteAction,revokeInviteAction,previewInviteAction,acceptInviteAction}=await import('../app/app/groups/invite-actions.ts');
const {INVITE_COOKIE,INVITE_PATH,inviteCookieOptions}=await import('../lib/groups/invite-cookie.ts');
const initial={error:null}, groupId='10000000-0000-4000-8000-000000000001', inviteId='20000000-0000-4000-8000-000000000001', token='a'.repeat(64);
const form=(values={})=>{const result=new FormData();for(const [key,value]of Object.entries(values))result.set(key,value);return result;};
beforeEach(()=>{env.configure(true);provider.configure();cookie.reset();cache.paths.length=0;});

test('missing configuration or session blocks issuing, revoking and joining without calling RPC',async()=>{
  for(const configured of [false,true]){
    env.configure(configured);provider.configure(false);
    for(const [action,data]of [[issueInviteAction,{groupId}],[revokeInviteAction,{groupId,inviteId}],[acceptInviteAction,{groupId}]]) assert.ok((await action(initial,form(data))).error);
    assert.equal(provider.calls.length,0);
  }
});
test('malformed identifiers and fragment tokens never call RPC or write a cookie',async()=>{
  assert.ok((await issueInviteAction(initial,form({groupId:'invalid'}))).error);
  assert.ok((await revokeInviteAction(initial,form({groupId,inviteId:'invalid'}))).error);
  assert.ok((await acceptInviteAction(initial,form({groupId:'invalid'}))).error);
  for(const value of ['', 'bad', 'z'.repeat(64)]) assert.ok((await previewInviteAction(initial,form({token:value}))).error);
  assert.equal(provider.calls.length,0);assert.equal(cookie.writes.length,0);
});
test('issuing sends only the token hash to the database and does not accept a forged issuer',async()=>{
  const result=await issueInviteAction(initial,form({groupId,userId:'attacker'}));
  assert.equal(result.error,null);assert.match(result.token,/^[0-9a-f]{64}$/);
  assert.deepEqual(provider.calls,[{name:'create_group_invite',input:{p_group_id:groupId,p_token_hash:createHash('sha256').update(result.token).digest('hex')}}]);
  assert.deepEqual(cache.paths,[`/app/groups/${groupId}/settings`]);
});
test('signed-out preview preserves the token for login without revealing a group or joining',async()=>{
  provider.configure(false);
  const result=await previewInviteAction(initial,form({token}));
  assert.deepEqual(result,{error:null,needLogin:true});assert.equal(provider.calls.length,0);
  assert.equal(cookie.writes[0].value,token);assert.equal(cookie.writes[0].options.path,INVITE_PATH);
  assert.equal(cookie.writes[0].options.httpOnly,true);assert.equal(cookie.writes[0].options.sameSite,'lax');
});
test('cookie security follows the runtime and expiration is bounded to seven days',()=>{
  const previous=process.env.NODE_ENV;
  try{process.env.NODE_ENV='production';assert.equal(inviteCookieOptions().secure,true);assert.equal(inviteCookieOptions().maxAge,7*86400);}
  finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
test('preview resumes after login and reveals the shared profile without joining',async()=>{
  cookie.values.set(INVITE_COOKIE,token);
  const result=await previewInviteAction(initial,form());
  assert.equal(result.preview.group_id,groupId);assert.equal(result.token,undefined);
  assert.equal(result.preview.description,'共有の紹介');assert.equal(result.preview.cover_path,null);
  assert.deepEqual(provider.calls,[{name:'preview_group_invite',input:{p_token:token}},{name:'preview_group_profile',input:{p_token:token}}]);assert.deepEqual(cache.paths,[]);
});
test('joining takes the token only from the cookie, verifies the confirmed group and redirects after invalidation',async()=>{
  cookie.values.set(INVITE_COOKIE,token);
  await assert.rejects(acceptInviteAction(initial,form({groupId,token:'forged',userId:'attacker'})),(error)=>error.location===`/app/groups/${groupId}`);
  assert.deepEqual(provider.calls,[{name:'accept_group_invite',input:{p_token:token,p_group_id:groupId}}]);
  assert.equal(cookie.writes.at(-1).options.maxAge,0);assert.equal(cookie.writes.at(-1).options.path,INVITE_PATH);
  assert.deepEqual(cache.paths,['/app/groups','/app',`/app/groups/${groupId}`]);
});
test('an absent pending cookie prevents membership changes',async()=>{
  assert.ok((await acceptInviteAction(initial,form({groupId,token}))).error);
  assert.equal(provider.calls.length,0);
});
test('failed or revoked invitations expose no provider data and do not clear the retry state',async()=>{
  cookie.values.set(INVITE_COOKIE,token);provider.configure(true,'P0001');
  const result=await acceptInviteAction(initial,form({groupId}));
  assert.match(result.error,/利用できません/);assert.doesNotMatch(result.error,/provider-private-data/);
  assert.equal(cookie.writes.length,0);assert.deepEqual(cache.paths,[]);
});
test('missing migrations are shown as not ready, rather than fake issuance success',async()=>{
  provider.configure(true,'PGRST202');
  const result=await issueInviteAction(initial,form({groupId}));
  assert.match(result.error,/準備中/);assert.equal(result.token,undefined);assert.deepEqual(cache.paths,[]);
});
test('revoking succeeds through its limited RPC and refreshes the group',async()=>{
  const result=await revokeInviteAction(initial,form({groupId,inviteId,userId:'attacker'}));
  assert.equal(result.success,true);assert.deepEqual(provider.calls,[{name:'revoke_group_invite',input:{p_invite_id:inviteId}}]);
  assert.deepEqual(cache.paths,[`/app/groups/${groupId}/settings`]);
});
