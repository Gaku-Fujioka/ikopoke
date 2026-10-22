import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const providerModule = moduleUrl(`
  let signedIn=false, refresh=false;
  export function configure(session=false,update=false){signedIn=session;refresh=update;}
  export function createServerClient(_url,_key,{cookies}){return {auth:{getClaims:async()=>{
    if(refresh)cookies.setAll([{name:'refreshed-session',value:'test-cookie',options:{httpOnly:true,path:'/'}}]);
    return {data:signedIn?{claims:{sub:'verified-user'}}:null};
  }}};}
`);
const nextModule = moduleUrl(`
  function response(status,location){const values=new Map();return {status,location,cookies:{set:(name,value,options)=>{
    if(typeof name==='object')values.set(name.name,name);else values.set(name,{name,value,...options});
  },getAll:()=>[...values.values()]}};}
  export const NextResponse={next:()=>response(200),redirect:(url)=>response(307,url.href)};
`);
const envModule = moduleUrl("export const hasEnvVars=true;");
registerHooks({resolve(specifier,context,next){const url={
  '@supabase/ssr':providerModule,'next/server':nextModule,'../utils':envModule,
  '../auth/safe-next-path':new URL('../lib/auth/safe-next-path.ts',import.meta.url).href,
}[specifier];return url?{url,shortCircuit:true}:next(specifier,context);}});
const provider=await import(providerModule);
const {updateSession}=await import('../lib/supabase/proxy.ts');
function request(path){const values=new Map();const url=new URL(path,'http://kokoiko.local');url.clone=()=>new URL(url);return {nextUrl:url,cookies:{getAll:()=>[...values.values()],set:(name,value)=>values.set(name,{name,value})}};}
beforeEach(()=>provider.configure());
test('anonymous invitation landing is public but other group routes remain protected',async()=>{
  assert.equal((await updateSession(request('/app/groups/join'))).status,200);
  for(const path of ['/app/groups','/app/groups/10000000-0000-4000-8000-000000000001','/app/groups/join/other']){
    const response=await updateSession(request(path));assert.equal(response.status,307);
    assert.equal(new URL(response.location).pathname,'/auth/login');assert.equal(new URL(response.location).searchParams.get('next'),path);
  }
});
test('signup and callback remain public while password updates require a session',async()=>{
  for(const path of ['/auth/sign-up','/auth/callback'])assert.equal((await updateSession(request(path))).status,200);
  assert.equal((await updateSession(request('/auth/update-password'))).status,307);
  assert.equal((await updateSession(request('/app/guide'))).status,307);
  provider.configure(true);assert.equal((await updateSession(request('/auth/update-password'))).status,200);
});

test('shared candidate list and detail require login and preserve their return path',async()=>{
  for(const path of ['/app/groups/10000000-0000-4000-8000-000000000001/items?page=2','/app/groups/10000000-0000-4000-8000-000000000001/items/20000000-0000-4000-8000-000000000001']){
    const response=await updateSession(request(path));
    assert.equal(response.status,307);assert.equal(new URL(response.location).searchParams.get('next'),path);
    provider.configure(true);assert.equal((await updateSession(request(path))).status,200);provider.configure(false);
  }
});
test('session refresh cookies survive a login redirect with app query retained',async()=>{
  provider.configure(false,true);
  const response=await updateSession(request('/app/items?q=cafe'));
  assert.equal(new URL(response.location).searchParams.get('next'),'/app/items?q=cafe');
  assert.deepEqual(response.cookies.getAll(),[{name:'refreshed-session',value:'test-cookie',httpOnly:true,path:'/'}]);
});
