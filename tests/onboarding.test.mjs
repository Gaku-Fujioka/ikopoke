import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const moduleURL = source => `data:text/javascript,${encodeURIComponent(source)}`;
const envURL = moduleURL("export let hasEnvVars=true; export function configure(value){hasEnvVars=value;}");
const providerURL = moduleURL(`
export let config={};export const calls=[];
export function configure(value={}){config=value;calls.length=0;}
export function usePathname(){return config.pathname??'/app';}
export async function createClient(){
 if(config.throw)throw Error('private-provider-detail');
 return {auth:{getClaims:async()=>({data:config.signedOut?null:{claims:{sub:'verified-user'}},error:config.claimError?{}:null})},
 from(table){let values,columns,userId;
 const query={
 select(value){columns=value;return query;},
 eq(column,value){userId=value;return query;},
 update(value){values=value;return query;},
 async maybeSingle(){calls.push({operation:'read',table,columns,userId});return {data:config.missing?null:{onboarding_version:config.version??0},error:config.readError?{message:'private-provider-detail'}:null};},
 async single(){calls.push({operation:'write',table,columns,userId,values});
  if(!config.writeError&&!config.zeroUpdated)config.version=values.onboarding_version;
  return {data:config.zeroUpdated?null:{user_id:userId},error:config.writeError?{message:'private-provider-detail'}:null};}
 };return query;}
 };
}
`);
const cacheURL = moduleURL("export const paths=[]; export function revalidatePath(...args){paths.push(args);}");
const navigationURL = moduleURL(`export {usePathname} from ${JSON.stringify(providerURL)};export function useRouter(){return {replace(){},refresh(){}};}`);
registerHooks({
  resolve(specifier, context, next) {
    const stub = {"@/lib/utils":envURL,"@/lib/supabase/server":providerURL,"next/cache":cacheURL,"next/navigation":navigationURL}[specifier];
    if (stub) return {url:stub,shortCircuit:true};
    if (specifier === "react" && context.parentURL?.startsWith("data:")) return next(specifier,{...context,parentURL:import.meta.url});
    if (specifier === "next/link") return {url:moduleURL("import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{href,...props},children);}"),shortCircuit:true};
    if (specifier.startsWith("@/") || ((specifier.startsWith("./") || specifier.startsWith("../")) && /\.tsx?$/.test(context.parentURL??""))) {
      const base=specifier.startsWith("@/")?new URL(`../${specifier.slice(2)}`,import.meta.url):new URL(specifier,context.parentURL);
      const url=[".ts",".tsx"].map(ext=>base.href+ext).find(url=>existsSync(fileURLToPath(url)));
      if(url)return {url,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next) {
    if(url.endsWith(".tsx"))return {format:"module",source:ts.transpileModule(readFileSync(fileURLToPath(url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});

const env=await import(envURL),provider=await import(providerURL),cache=await import(cacheURL);
const {FirstLoginGuide}=await import("../components/onboarding/first-login-guide.tsx");
const {GuideDialog}=await import("../components/onboarding/guide.tsx");
const {default:GuidePage}=await import("../app/app/guide/page.tsx");
const {acknowledgeGuideAction}=await import("../app/app/guide/actions.ts");
const {hasSeenGuide}=await import("../lib/onboarding/repository.ts");
const {GUIDE_VERSION,deferGuide}=await import("../lib/onboarding/guide.ts");
const render=component=>renderToStaticMarkup(createElement(component));
beforeEach(()=>{env.configure(true);provider.configure();cache.paths.length=0;});

test("optional onboarding skips unconfigured and signed-out sessions without profile reads or writes",async()=>{
  env.configure(false);
  assert.equal(await FirstLoginGuide(),null);
  assert.ok((await acknowledgeGuideAction()).error);
  env.configure(true);provider.configure({signedOut:true});
  assert.equal(await FirstLoginGuide(),null);
  assert.ok((await acknowledgeGuideAction()).error);
  assert.deepEqual(provider.calls,[]);
});

test("an unseen account is introduced once and acknowledging it persists across subsequent reads",async()=>{
  assert.equal((await FirstLoginGuide()).type,GuideDialog);
  assert.deepEqual(await acknowledgeGuideAction({userId:'forged-user',version:999}),{error:null});
  assert.deepEqual(provider.calls.find(call=>call.operation==='write'),{
    operation:'write',table:'profiles',columns:'user_id',userId:'verified-user',values:{onboarding_version:GUIDE_VERSION},
  });
  assert.deepEqual(cache.paths,[["/app","layout"]]);
  assert.equal(await FirstLoginGuide(),null);
  provider.configure({version:GUIDE_VERSION+1});
  assert.equal(await FirstLoginGuide(),null);
});

test("missing profiles can see the guide and zero-row writes or provider failures never claim success",async()=>{
  provider.configure({missing:true});
  assert.equal((await FirstLoginGuide()).type,GuideDialog);
  for (const config of [{writeError:true},{zeroUpdated:true},{throw:true},{claimError:true}]) {
    provider.configure(config);cache.paths.length=0;
    const result=await acknowledgeGuideAction();
    assert.ok(result.error);
    assert.doesNotMatch(result.error,/private-provider-detail|verified-user/);
    assert.deepEqual(cache.paths,[]);
  }
});

test("profile read failures and malformed versions cannot take down the app or masquerade as seen",async()=>{
  for(const config of [{readError:true},{throw:true},{version:-1},{version:'1'}]){
    provider.configure(config);
    assert.equal(await FirstLoginGuide(),null);
    await assert.rejects(async()=>hasSeenGuide(await provider.createClient(),'verified-user'));
  }
});

test("automatic introduction defers invitations and replay but resumes after joining",()=>{
  for(const pathname of ["/app/groups/join","/app/guide"]){
    provider.configure({pathname});
    assert.equal(deferGuide(pathname),true);
    assert.equal(render(GuideDialog),"");
  }
  for(const pathname of ["/app","/app/groups/example","/app/profile"]){
    provider.configure({pathname});
    assert.equal(deferGuide(pathname),false);
    const markup=render(GuideDialog);
    assert.match(markup,/<dialog[^>]+aria-labelledby="guide-title"/);
    assert.match(markup,/id="guide-title"/);
    assert.match(markup,/あとで見る/);
    assert.match(markup,/ステップ1、全6ステップ/);
  }
});

test("a replay page stays available after acknowledgement and provides a way back to the profile",()=>{
  provider.configure({version:GUIDE_VERSION,pathname:'/app/guide'});
  const markup=render(GuidePage);
  assert.match(markup,/href="\/app\/profile"/);
  assert.match(markup,/使い方ガイド/);
  assert.match(markup,/プロフィールの「使い方ガイド」/);
  assert.match(markup,/次へ/);
  assert.doesNotMatch(markup,/<dialog/);
});
