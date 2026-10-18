import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const moduleURL=source=>`data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier,context,next){
    if(specifier==='react'&&context.parentURL?.startsWith('data:'))return next(specifier,{...context,parentURL:import.meta.url});
    if(specifier==='next/link')return {url:moduleURL("import {createElement} from 'react';export default function Link(props){return createElement('a',props);}"),shortCircuit:true};
    if(specifier.startsWith('@/')||(specifier.startsWith('./')&&/\.tsx?$/.test(context.parentURL??''))){
      const base=specifier.startsWith('@/')?new URL(`../${specifier.slice(2)}`,import.meta.url):new URL(specifier,context.parentURL);
      const url=['.ts','.tsx'].map(ext=>base.href+ext).find(url=>existsSync(fileURLToPath(url)));
      if(url)return {url,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {createMapExplorer,googleMapsPlaceHref,googleMapsSearchHref}=await import('../lib/maps/explorer.ts');
const {createGoogleLoader,createGoogleMapStarter,placeResult,deadline}=await import('../lib/maps/google.ts');
const {PlaceExplorer}=await import('../components/maps/place-explorer.tsx');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const host=()=>({replaceChildren(){this.cleaned=true;}});
const place={id:'synthetic-place',name:'<カフェ>',address:'テストの街',position:{lat:35,lng:139},attributions:[]};
const config={enabled:true,placesEnabled:true,apiKey:'synthetic-browser-key',mapId:'synthetic-map-id'};

test('SDK stays unloaded until explicitly opened; repeated opens and duplicate searches do not spend more requests',async()=>{
  let opens=0,searches=0,disposals=0;
  const opening=deferred(),searching=deferred();
  const explorer=createMapExplorer(async()=>{opens++;return opening.promise;});
  assert.equal(opens,0);assert.equal(explorer.getSnapshot().phase,'closed');
  const pending=explorer.open(host());await explorer.open(host());assert.equal(opens,1);
  opening.resolve({search:async query=>{searches++;assert.equal(query,'吉祥寺 カフェ');return searching.promise;},select(){},dispose(){disposals++;}});
  await pending;assert.equal(explorer.getSnapshot().phase,'ready');
  const result=explorer.search(' 吉祥寺 カフェ ');await explorer.search('別の検索');assert.equal(searches,1);assert.equal(explorer.getSnapshot().searching,true);
  searching.resolve([place]);await result;
  assert.deepEqual(explorer.getSnapshot().results,[place]);assert.equal(explorer.getSnapshot().searched,'吉祥寺 カフェ');
  explorer.dispose();assert.equal(disposals,1);
});
test('invalid searches do not call Google; selection only accepts currently returned IDs',async()=>{
  let calls=0;const selected=[];
  const explorer=createMapExplorer(async()=>({search:async()=>{calls++;return [place];},select:value=>selected.push(value),dispose(){}}));
  await explorer.search('not opened');await explorer.open(host());
  for(const query of ['','   ','あ'.repeat(101)]){await explorer.search(query);assert.match(explorer.getSnapshot().error,/1〜100/);}
  assert.equal(calls,0);await explorer.search('あ'.repeat(100));explorer.select('other');explorer.select(place.id);
  assert.deepEqual(selected,[place]);assert.equal(explorer.getSnapshot().selected,place.id);explorer.dispose();
});
test('provider errors and quota failures clear stale results without displaying private error details',async()=>{
  let fail=false;
  const explorer=createMapExplorer(async()=>({search:async()=>{if(fail)throw Error('private-token-provider-details');return [place];},select(){},dispose(){}}));
  await explorer.open(host());await explorer.search('最初');fail=true;await explorer.search('失敗');
  assert.deepEqual(explorer.getSnapshot().results,[]);assert.equal(explorer.getSnapshot().searched,null);
  assert.match(explorer.getSnapshot().error,/検索できません/);assert.ok(!explorer.getSnapshot().error.includes('private'));
  assert.equal(explorer.getSnapshot().phase,'ready');assert.equal(explorer.getSnapshot().searching,false);explorer.dispose();
});
test('unmount and auth failure discard in-flight results and release resources',async()=>{
  for(const abort of ['unmount','auth']){
    let fatal,disposed=0;const request=deferred();
    const explorer=createMapExplorer(async(element,onFailure)=>{fatal=onFailure;return {search:()=>request.promise,select(){},dispose(){disposed++;}};});
    await explorer.open(host());const pending=explorer.search('遅い検索');
    if(abort==='auth')fatal();else explorer.dispose();
    request.resolve([place]);await pending;
    assert.equal(disposed,1);assert.deepEqual(explorer.getSnapshot().results,[]);assert.equal(explorer.getSnapshot().searching,false);
    assert.equal(explorer.getSnapshot().phase,abort==='auth'?'failed':'closed');
  }
});
test('unmount during SDK initialization disposes the late map and ignores its late auth failure',async()=>{
  const opening=deferred();let fatal,disposed=0;
  const explorer=createMapExplorer(async(element,onFailure)=>{fatal=onFailure;return opening.promise;});
  const pending=explorer.open(host());explorer.dispose();fatal();
  opening.resolve({dispose(){disposed++;}});await pending;
  assert.equal(disposed,1);assert.equal(explorer.getSnapshot().phase,'closed');
});
test('script is inserted once, uses Japanese with referrer policy, and authenticates through fixed callback',async()=>{
  const scripts=[],browser={};
  const document={getElementById:()=>null,createElement:()=>({}),head:{append:value=>scripts.push(value)}};
  const loader=createGoogleLoader(browser,document);
  assert.equal(scripts.length,0);
  const first=loader.load('synthetic-browser-key'),second=loader.load('synthetic-browser-key');assert.equal(first,second);assert.equal(scripts.length,1);
  const url=new URL(scripts[0].src);assert.equal(url.origin,'https://maps.googleapis.com');assert.equal(url.searchParams.get('language'),'ja');assert.equal(url.searchParams.get('auth_referrer_policy'),'origin');assert.equal(url.searchParams.get('loading'),'async');assert.equal(url.searchParams.has('libraries'),false);
  browser.google={maps:{importLibrary(){}}};browser.__kokoikoMapsReady();assert.equal(await first,browser.google.maps);
});
test('network failure never auto-retries; auth failure remains observable after SDK loading',async()=>{
  for(const reason of ['network','auth']){
    const scripts=[],browser={};let failures=0;
    const loader=createGoogleLoader(browser,{getElementById:()=>null,createElement:()=>({}),head:{append:value=>scripts.push(value)}});
    loader.subscribeFailure(()=>failures++);const pending=loader.load('synthetic');
    if(reason==='network'){
      scripts[0].onerror();await assert.rejects(pending,/maps_unavailable/);assert.equal(loader.load('synthetic'),pending);assert.equal(scripts.length,1);
    }else{browser.google={maps:{importLibrary(){}}};browser.__kokoikoMapsReady();await pending;browser.gm_authFailure();}
    assert.equal(loader.failed,true);assert.ok(failures>0);
  }
});
function fakeSDK({search=async()=>({places:[]}),markerPromise=null}={}){
  const imports=[],requests=[],markers=[],pans=[];let maps=0,cleared=0;
  const sdk={
    async importLibrary(name){imports.push(name);
      if(name==='maps')return {Map:class{constructor(){maps++;}panTo(point){pans.push(point);}setZoom(){}}};
      if(name==='places')return {Place:{searchByText(request){requests.push(request);return search(request);}}};
      if(name==='marker')return markerPromise??{AdvancedMarkerElement:class{constructor(options){Object.assign(this,options);markers.push(this);}}};
      throw Error('unexpected import');
    },
    event:{addListenerOnce(map,event,callback){queueMicrotask(callback);return {remove(){}};},clearInstanceListeners(){cleared++;}},
  };
  const loader={failed:false,load:async()=>sdk,subscribeFailure(){return ()=>{};}};
  return {start:createGoogleMapStarter(loader),imports,requests,markers,pans,get maps(){return maps;},get cleared(){return cleared;}};
}
test('new Places search is lazy and uses limited fields/count; repeated searches reuse the map',async()=>{
  const raw={id:place.id,displayName:place.name,formattedAddress:place.address,location:{lat:()=>35,lng:()=>139}};
  const fake=fakeSDK({search:async()=>({places:[raw]})}),element=host();
  const session=await fake.start(element,config,()=>{});assert.deepEqual(fake.imports,['maps']);
  assert.deepEqual(await session.search('吉祥寺'),[place]);await session.search('東京');assert.equal(fake.maps,1);
  assert.deepEqual(fake.imports,['maps','places']);assert.equal(fake.requests.length,2);
  const request=fake.requests[0];assert.equal(request.textQuery,'吉祥寺');assert.equal(request.maxResultCount,5);
  assert.deepEqual(request.fields,['id','displayName','formattedAddress','location','attributions']);
  assert.ok(!JSON.stringify(request).includes('photos'));assert.ok(!JSON.stringify(request).includes('rating'));
  session.select(place);await flush();assert.equal(fake.markers.length,1);assert.deepEqual(fake.pans,[place.position]);
  session.dispose();assert.equal(fake.markers[0].map,null);assert.equal(element.cleaned,true);assert.equal(fake.cleared,1);
});
test('search can be disabled independently; it never imports or requests Places',async()=>{
  const fake=fakeSDK();const session=await fake.start(host(),{...config,placesEnabled:false},()=>{});
  await assert.rejects(session.search('場所'),/maps_unavailable/);assert.deepEqual(fake.imports,['maps']);assert.equal(fake.requests.length,0);session.dispose();
  for(const invalid of [{...config,enabled:false},{...config,apiKey:''},{...config,mapId:''}])await assert.rejects(fake.start(host(),invalid,()=>{}),/maps_unavailable/);
  assert.equal(fake.maps,1);
});
test('pending markers cannot reappear over a newer search or after unmount',async()=>{
  for(const abort of ['search','dispose']){
    const marker=deferred(),created=[];const fake=fakeSDK({markerPromise:marker.promise});const session=await fake.start(host(),config,()=>{});
    session.select(place);if(abort==='search')await session.search('次の場所');else session.dispose();
    marker.resolve({AdvancedMarkerElement:class{constructor(value){created.push(value);}}});await flush();assert.equal(created.length,0);session.dispose();
  }
});
test('navigation during SDK loading aborts before constructing a map on the detached host',async()=>{
  const loading=deferred();let constructions=0;
  const sdk={importLibrary:async()=>({Map:class{constructor(){constructions++;}}})};
  const starter=createGoogleMapStarter({failed:false,load:()=>loading.promise,subscribeFailure:()=>()=>{}});
  const aborter=new AbortController(),element=host();
  const pending=starter(element,config,()=>{},aborter.signal);aborter.abort();loading.resolve(sdk);
  await assert.rejects(pending,/maps_unavailable/);assert.equal(constructions,0);assert.equal(element.cleaned,true);
});
test('unusable coordinates are not fabricated and external attribution links cannot inject executable schemes',()=>{
  const raw={id:'id',displayName:'<script>alert(1)</script>',location:{lat:()=>35,lng:()=>139},attributions:[{provider:'<provider>',providerURI:'javascript:alert(1)'},{provider:'HTTPS',providerURI:'https://example.com/source'}]};
  const parsed=placeResult(raw);assert.equal(parsed.name,raw.displayName);assert.equal(parsed.attributions[0].uri,null);assert.equal(parsed.attributions[1].uri,'https://example.com/source');
  assert.equal(placeResult({...raw,location:undefined}),null);assert.equal(placeResult({...raw,location:{lat:()=>NaN,lng:()=>139}}),null);
  assert.equal(placeResult({...raw,location:{lat:()=>91,lng:()=>139}}),null);
  const url=new URL(googleMapsPlaceHref({...place,id:'id&malicious=true',name:'A&B'}));assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('query_place_id'),'id&malicious=true');assert.equal(url.searchParams.get('query'),'A&B');assert.equal(url.searchParams.has('malicious'),false);
  const titleSearch=new URL(googleMapsSearchHref('A&B #カフェ'));assert.equal(titleSearch.searchParams.get('query'),'A&B #カフェ');assert.equal(titleSearch.searchParams.has('query_place_id'),false);
});
test('deadlines return a generic error without exposing provider credentials',async()=>{
  await assert.rejects(deadline(Promise.reject(Error('sensitive provider message')),50),error=>error.message==='maps_unavailable');
  await assert.rejects(deadline(new Promise(()=>{}),5),/maps_unavailable/);
});
test('SSR gives opt-in or manual fallback and never embeds a Maps script or browser key in markup',()=>{
  for(const enabled of [false,true]){
    const markup=renderToStaticMarkup(createElement(PlaceExplorer,{config:{...config,enabled},addHref:'/app/new?type=item'}));
    assert.ok(!markup.includes('<script'));assert.ok(!markup.includes(config.apiKey));assert.ok(!markup.includes('maps.googleapis.com'));
    assert.match(markup,enabled?/地図をひらく/:/地図は準備中/);assert.match(markup,/hidden=""/);
    if(!enabled)assert.ok(markup.includes('href="/app/new?type=item"'));
  }
});
