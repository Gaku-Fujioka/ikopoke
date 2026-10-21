import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import vm from 'node:vm';
import {test} from 'node:test';
import {startPwa} from '../lib/pwa/client.ts';
import manifest from '../app/manifest.ts';
import nextConfig from '../next.config.ts';
import {pocketIconSvg} from '../lib/brand/pocket-mark.ts';
registerHooks({resolve(s,c,next){if(s==='@/lib/supabase/proxy')return {url:'data:text/javascript,export async function updateSession(){}',shortCircuit:true};if(s==='next/server')return {url:'data:text/javascript,export {}',shortCircuit:true};return next(s,c);}});
const {config}=await import('../proxy.ts');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('manifest launches the protected app, provides maskable/Apple/launcher icons and matches the shared SVG source',()=>{
  const data=manifest();assert.equal(data.name,'いこポケ');assert.equal(data.start_url,'/app');assert.equal(data.display,'standalone');assert.equal(data.theme_color,'#ffae45');
  assert.ok(data.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
  for(const size of [192,512]){const png=readFileSync(new URL(`../public/brand/icon-${size}.png`,import.meta.url));assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
  const apple=readFileSync(new URL('../app/apple-icon.png',import.meta.url));assert.equal(apple.readUInt32BE(16),180);
  const ico=readFileSync(new URL('../app/favicon.ico',import.meta.url));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
  assert.equal(readFileSync(new URL('../public/brand/ikopoke.svg',import.meta.url),'utf8'),pocketIconSvg());
});
test('only exact public PWA resources bypass proxy; app, finance, auth and similarly named paths retain existing checks',async()=>{
  const matches=path=>new RegExp('^'+config.matcher[0]+'$').test(path);
  for(const path of ['/sw.js','/offline.html','/manifest.webmanifest','/brand/icon-192.png'])assert.equal(matches(path),false,path);
  for(const path of ['/app','/app/install','/app/finance','/app/offline.html','/offline.html/extra','/sw.js/extra','/auth/callback'])assert.equal(matches(path),true,path);
  const headers=(await nextConfig.headers()).find(rule=>rule.source==='/sw.js').headers;
  assert.ok(headers.some(header=>header.key==='Cache-Control'&&header.value.includes('no-store')));
});

function workerFixture(){
  const handlers={},cached=[],deleted=[],network=[],messages=[];let offline=false,missing=false,skip=0,claim=0;
  const fallback=new Response('public-offline-shell');
  const self={location:{origin:'https://ikopoke.test'},clients:{claim:async()=>{claim++;}},skipWaiting:()=>{skip++;},addEventListener:(event,fn)=>{handlers[event]=fn;}};
  const caches={open:async name=>{assert.equal(name,'ikopoke-shell-v1');return {add:async url=>cached.push([name,url]),match:async url=>{assert.equal(url,'/offline.html');return missing?undefined:fallback.clone();}};},keys:async()=>['unrelated-app','ikopoke-shell-old','ikopoke-shell-v1'],delete:async key=>deleted.push(key)};
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,caches,URL,Response,fetch:async(req,options)=>{network.push([req,options]);if(offline)throw Error('network');return new Response('private-live-response');}});
  return {handlers,cached,deleted,network,messages,setOffline:()=>{offline=true;},setMissing:()=>{missing=true;},stats:()=>({skip,claim}),async lifecycle(name){let pending;handlers[name]({waitUntil:value=>{pending=value;}});await pending;},async request(path,override={}){let response;handlers.fetch({request:{url:new URL(path,'https://ikopoke.test').href,method:'GET',mode:'navigate',...override},respondWith:value=>{response=value;}});return response?await response:undefined;}};
}
test('worker installs only the public shell, cleans its own caches and never forces an update on install',async()=>{
  const w=workerFixture();await w.lifecycle('install');assert.deepEqual(w.cached,[['ikopoke-shell-v1','/offline.html']]);assert.equal(w.stats().skip,0);
  await w.lifecycle('activate');assert.deepEqual(w.deleted,['ikopoke-shell-old']);assert.equal(w.stats().claim,1);
  w.handlers.message({data:{type:'other'}});assert.equal(w.stats().skip,0);w.handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(w.stats().skip,1);
});
test('worker does not intercept auth, RSC, Storage, POST or external requests; live app responses are never cached',async()=>{
  const w=workerFixture();for(const [path,override] of [['/auth/callback',{}],['/app/items?_rsc=payload',{mode:'cors'}],['/app/finance',{method:'POST'}],['https://storage.invalid/photo',{mode:'cors'}],['https://external.invalid/app',{}]])assert.equal(await w.request(path,override),undefined);
  assert.equal(w.network.length,0);
  assert.equal(await(await w.request('/app/finance')).text(),'private-live-response');assert.equal(w.network.length,1);assert.equal(w.network[0][1].cache,'no-store');assert.deepEqual(w.cached,[]);
});
test('failed app navigations get only a public shell; missing shell gives a 503 rather than stale private content',async()=>{
  const w=workerFixture();w.setOffline();assert.equal(await(await w.request('/app/groups/example/visits')).text(),'public-offline-shell');
  w.setMissing();const result=await w.request('/app');assert.equal(result.status,503);assert.match(await result.text(),/通信できません/);assert.deepEqual(w.cached,[]);
});

function clientFixture({unsupported=false,insecure=false,ios=false,standalone=false,rejectRegister=false}={}){
  const win=new EventTarget(),doc=new EventTarget(),sw=new EventTarget(),registration=new EventTarget(),media=new EventTarget();let reloads=0,updates=0,prompts=0;const timers=new Map(),registerCalls=[],snapshots=[],sent=[];
  media.matches=standalone;Object.assign(win,{isSecureContext:!insecure,matchMedia:()=>media,location:{reload:()=>{reloads++;}},setTimeout:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  Object.assign(doc,{visibilityState:'visible'});Object.assign(registration,{waiting:null,installing:null,update:async()=>{updates++;}});
  sw.register=async(...args)=>{registerCalls.push(args);if(rejectRegister)throw Error('private provider');return registration;};
  const nav={onLine:true,userAgent:ios?'iPhone':'browser',platform:'',maxTouchPoints:0,...(unsupported?{}:{serviceWorker:sw})};
  const controller=startPwa(win,nav,doc,state=>snapshots.push(state));
  return {win,nav,doc,sw,media,registration,timers,registerCalls,snapshots,sent,controller,state:()=>snapshots.at(-1),stats:()=>({reloads,updates,prompts}),installEvent(outcome='dismissed',rejected=false){const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{prompts++;if(rejected)throw Error('private detail');};event.userChoice=Promise.resolve({outcome});win.dispatchEvent(event);return event;},waiting(){registration.waiting={postMessage:message=>sent.push(message)};registration.dispatchEvent(new Event('updatefound'));}};
}
test('install is gesture driven and single use; accepting/dismissing is not mistaken for an installed event',async()=>{
  const f=clientFixture();await flush();assert.equal(f.registerCalls[0][0],'/sw.js');assert.equal(f.registerCalls[0][1].updateViaCache,'none');
  const event=f.installEvent('accepted');assert.equal(event.defaultPrevented,true);assert.equal(f.stats().prompts,0);assert.equal(f.state().canInstall,true);
  await Promise.all([f.controller.install(),f.controller.install()]);assert.equal(f.stats().prompts,1);assert.equal(f.state().installed,false);assert.equal(f.state().busy,false);
  f.win.dispatchEvent(new Event('appinstalled'));assert.equal(f.state().installed,true);assert.equal(f.state().canInstall,false);
  f.controller.dispose();
});
test('unsupported or insecure browsers do not register a worker; standalone and iOS states remain available',async()=>{
  for(const options of [{unsupported:true,ios:true},{insecure:true,standalone:true}]){const f=clientFixture(options);await flush();assert.equal(f.registerCalls.length,0);assert.equal(f.state().ios,!!options.ios);assert.equal(f.state().installed,!!options.standalone);f.controller.dispose();}
});
test('updates wait for explicit action; first control and other-tab changes never reload an edited screen',async()=>{
  const f=clientFixture();await flush();f.sw.dispatchEvent(new Event('controllerchange'));assert.equal(f.stats().reloads,0);
  f.waiting();assert.equal(f.state().waiting,true);assert.equal(f.sent.length,0);
  f.controller.update();assert.deepEqual(f.sent,[{type:'SKIP_WAITING'}]);assert.equal(f.state().busy,true);
  f.sw.dispatchEvent(new Event('controllerchange'));assert.equal(f.stats().reloads,1);assert.equal(f.timers.size,0);
  f.sw.dispatchEvent(new Event('controllerchange'));assert.equal(f.stats().reloads,1);f.controller.dispose();
});
test('timed-out updates stop waiting and cannot reload later after the user resumes editing',async()=>{
  const f=clientFixture();await flush();f.waiting();f.controller.update();[...f.timers.values()][0]();
  assert.equal(f.state().busy,false);assert.match(f.state().error,/時間/);f.registration.waiting=null;f.sw.dispatchEvent(new Event('controllerchange'));assert.equal(f.stats().reloads,0);assert.equal(f.state().waiting,false);assert.equal(f.state().error,null);f.controller.dispose();
});
test('offline, install errors, registration errors and disposal preserve an honest state without provider details',async()=>{
  const f=clientFixture();await flush();f.win.dispatchEvent(new Event('offline'));assert.equal(f.state().offline,true);f.win.dispatchEvent(new Event('online'));assert.equal(f.state().offline,false);
  f.installEvent('dismissed',true);await f.controller.install();assert.match(f.state().error,/完了できません/);assert.ok(!f.state().error.includes('private'));
  f.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(f.stats().updates,1);
  const count=f.snapshots.length;f.controller.dispose();f.win.dispatchEvent(new Event('offline'));assert.equal(f.snapshots.length,count);
  const bad=clientFixture({rejectRegister:true});await flush();assert.match(bad.state().error,/準備/);assert.ok(!bad.state().error.includes('private'));bad.controller.dispose();
});
