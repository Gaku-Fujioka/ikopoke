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
const {createGoogleLoader,createGoogleMapStarter,placeResult,detailResult,deadline}=await import('../lib/maps/google.ts');
const {PlaceExplorer}=await import('../components/maps/place-explorer.tsx');
const {PlaceDetailPanel}=await import('../components/maps/place-detail-panel.tsx');
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
function fakeSDK({search=async()=>({places:[]}),markerPromise=null,fetchDetails=async()=>({})}={}){
  const imports=[],requests=[],markers=[],pans=[],fits=[],detailRequests=[];let maps=0,cleared=0;
  const sdk={
    async importLibrary(name){imports.push(name);
      if(name==='maps')return {Map:class{constructor(){maps++;}panTo(point){pans.push(point);}setZoom(){}fitBounds(bounds,padding){fits.push({points:bounds.points,padding});}},LatLngBounds:class{points=[];extend(point){this.points.push(point);}}};
      if(name==='places')return {Place:class{
        constructor(options){this.id=options.id;}
        static searchByText(request){requests.push(request);return search(request);}
        async fetchFields(request){detailRequests.push({id:this.id,request});Object.assign(this,await fetchDetails(this.id,request));}
      }};
      if(name==='marker')return markerPromise??{AdvancedMarkerElement:class{events=new Map();constructor(options){Object.assign(this,options);markers.push(this);}addEventListener(event,callback){this.events.set(event,callback);}removeEventListener(event){this.events.delete(event);}}};
      throw Error('unexpected import');
    },
    event:{addListenerOnce(map,event,callback){queueMicrotask(callback);return {remove(){}};},clearInstanceListeners(){cleared++;}},
  };
  const loader={failed:false,load:async()=>sdk,subscribeFailure(){return ()=>{};}};
  return {start:createGoogleMapStarter(loader),imports,requests,markers,pans,fits,detailRequests,get maps(){return maps;},get cleared(){return cleared;}};
}
test('new Places search is lazy and uses limited fields/count; repeated searches reuse the map',async()=>{
  const raw={id:place.id,displayName:place.name,formattedAddress:place.address,location:{lat:()=>35,lng:()=>139}};
  const fake=fakeSDK({search:async()=>({places:[raw]})}),element=host();
  const session=await fake.start(element,config,()=>{});assert.deepEqual(fake.imports,['maps']);
  assert.deepEqual(await session.search('吉祥寺'),[place]);await session.search('東京');assert.equal(fake.maps,1);
  assert.deepEqual(fake.imports,['maps','places','marker']);assert.equal(fake.requests.length,2);
  const request=fake.requests[0];assert.equal(request.textQuery,'吉祥寺');assert.equal(request.maxResultCount,5);
  assert.deepEqual(request.fields,['id','displayName','formattedAddress','location','attributions']);
  assert.ok(!JSON.stringify(request).includes('photos'));assert.ok(!JSON.stringify(request).includes('rating'));
  assert.equal(fake.markers.length,2);assert.equal(fake.markers[0].map,null);assert.equal(fake.markers[1].gmpClickable,true);assert.equal(fake.detailRequests.length,0);
  session.select(place);await flush();assert.equal(fake.markers.length,2);assert.deepEqual(fake.pans,[place.position,place.position,place.position]);
  session.dispose();assert.equal(fake.markers[1].map,null);assert.equal(element.cleaned,true);assert.equal(fake.cleared,1);
});
test('search can be disabled independently; it never imports or requests Places',async()=>{
  const fake=fakeSDK();const session=await fake.start(host(),{...config,placesEnabled:false},()=>{});
  await assert.rejects(session.search('場所'),/maps_unavailable/);assert.deepEqual(fake.imports,['maps']);assert.equal(fake.requests.length,0);session.dispose();
  for(const invalid of [{...config,enabled:false},{...config,apiKey:''},{...config,mapId:''}])await assert.rejects(fake.start(host(),invalid,()=>{}),/maps_unavailable/);
  assert.equal(fake.maps,1);
});
test('pending result markers cannot reappear after unmount',async()=>{
  const marker=deferred(),created=[];const raw={id:place.id,displayName:place.name,location:{lat:()=>35,lng:()=>139}};
  const fake=fakeSDK({markerPromise:marker.promise,search:async()=>({places:[raw]})});const session=await fake.start(host(),config,()=>{});
  const pending=session.search('場所');await flush();session.dispose();
  marker.resolve({AdvancedMarkerElement:class{constructor(value){created.push(value);}}});await assert.rejects(pending,/maps_unavailable/);assert.equal(created.length,0);
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
test('new-place search is visible before opening the map and has no navigation form action',()=>{
  const markup=renderToStaticMarkup(createElement(PlaceExplorer,{config,addHref:'/app/new?type=item'}));
  assert.match(markup,/<h3[^>]*>新しい場所を探す<\/h3>/);
  assert.match(markup,/<form[^>]*aria-label="新しい場所を検索"/);
  assert.match(markup,/場所を検索/);
  assert.ok(!markup.includes('action="/app/items'));
  assert.ok(!markup.includes('<script'));
});
test('submitting a new-place search opens the map once and searches after ready, without a separate open action',async()=>{
  let opens=0;const queries=[],opening=deferred();
  const explorer=createMapExplorer(async()=>{opens++;return opening.promise;});
  const pending=explorer.searchOnMap(host(),' 吉祥寺 カフェ ');
  await explorer.searchOnMap(host(),'二重送信');assert.equal(opens,1);assert.deepEqual(queries,[]);
  opening.resolve({search:async query=>{queries.push(query);return [place];},select(){},dispose(){}});await pending;
  assert.deepEqual(queries,['吉祥寺 カフェ']);assert.deepEqual(explorer.getSnapshot().results,[place]);assert.equal(explorer.getSnapshot().phase,'ready');
  await explorer.searchOnMap(host(),'別の街');assert.equal(opens,1);assert.deepEqual(queries,['吉祥寺 カフェ','別の街']);explorer.dispose();
});
test('invalid initial searches never initialize a paid map or call Places',async()=>{
  let opens=0;const explorer=createMapExplorer(async()=>{opens++;throw Error('must not open');});
  for(const query of ['   ','あ'.repeat(101)]){await explorer.searchOnMap(host(),query);assert.equal(explorer.getSnapshot().phase,'closed');assert.match(explorer.getSnapshot().error,/1〜100/);}
  assert.equal(opens,0);explorer.dispose();
});
test('a submitted search never reaches Places after SDK failure or navigation during initialization',async()=>{
  let searches=0;
  const failed=createMapExplorer(async()=>{throw Error('private');});await failed.searchOnMap(host(),'検索');assert.equal(failed.getSnapshot().phase,'failed');assert.deepEqual(failed.getSnapshot().results,[]);
  const opening=deferred(),explorer=createMapExplorer(()=>opening.promise);const pending=explorer.searchOnMap(host(),'検索');explorer.dispose();
  opening.resolve({search:async()=>{searches++;return [place];},dispose(){},select(){}});await pending;assert.equal(searches,0);assert.equal(explorer.getSnapshot().phase,'closed');
});
test('the new-place form is absent when Maps or Places is disabled, while manual fallback remains',()=>{
  for(const patch of [{enabled:false},{placesEnabled:false},{apiKey:''},{mapId:''}]){
    const markup=renderToStaticMarkup(createElement(PlaceExplorer,{config:{...config,...patch},addHref:'/app/new?type=item'}));
    assert.ok(!markup.includes('aria-label="新しい場所を検索"'));assert.ok(!markup.includes('action="/app/items'));
  }
});
const rawPlace = (id,lat=35,lng=139) => ({id,displayName:id,location:{lat:()=>lat,lng:()=>lng}});
const noDetails={rating:null,ratingCount:null,photo:null,reviews:[],attributions:[]};
test('all result pins appear without selection, fit the map, and pin clicks open the same details as list selection',async()=>{
  const raw=[rawPlace('one'),rawPlace('two',35.2,139.1),rawPlace('three',35.3,139.2)];
  const fake=fakeSDK({search:async()=>({places:raw})});
  const explorer=createMapExplorer((host,failure,signal,onSelect)=>fake.start(host,config,failure,signal,onSelect));
  await explorer.searchOnMap(host(),'カフェ');
  assert.equal(fake.markers.length,3);assert.equal(explorer.getSnapshot().selected,null);assert.equal(fake.detailRequests.length,0);
  assert.deepEqual(fake.fits,[{points:raw.map(p=>({lat:p.location.lat(),lng:p.location.lng()})),padding:32}]);
  fake.markers[1].events.get('gmp-click')();await flush();assert.equal(explorer.getSnapshot().selected,'two');assert.equal(fake.detailRequests.length,1);assert.equal(fake.detailRequests[0].id,'two');
  assert.deepEqual(fake.detailRequests[0].request.fields,['rating','userRatingCount','photos','reviews','attributions']);
  assert.equal(fake.markers[1].zIndex,100);assert.equal(fake.markers.filter(p=>p.map).length,3);
  const previousClick=fake.markers[0].events.get('gmp-click');await explorer.search('別の街');previousClick();assert.equal(explorer.getSnapshot().selected,null);assert.equal(fake.detailRequests.length,1);
  assert.equal(fake.markers.slice(0,3).every(marker=>marker.map===null&&marker.events.size===0),true);explorer.dispose();
});
test('selection loads details only once while loading or ready and ignores results from a previously selected place',async()=>{
  const first=deferred(),second=deferred(),calls=[],signals=[];
  const other={...place,id:'other'};
  const explorer=createMapExplorer(async()=>({search:async()=>[place,other],select(){},details(p,signal){calls.push(p.id);signals.push(signal);return p.id===place.id?first.promise:second.promise;},dispose(){}}));
  await explorer.open(host());await explorer.search('場所');const pending=explorer.select(place.id);await explorer.select(place.id);assert.equal(calls.length,1);
  const next=explorer.select(other.id);assert.equal(signals[0].aborted,true);first.resolve({...noDetails,rating:1});await pending;
  assert.equal(explorer.getSnapshot().selected,other.id);assert.equal(explorer.getSnapshot().details,null);assert.equal(explorer.getSnapshot().detailStatus,'loading');
  second.resolve({...noDetails,rating:4.5});await next;await explorer.select(other.id);assert.deepEqual(calls,[place.id,other.id]);assert.equal(explorer.getSnapshot().details.rating,4.5);explorer.dispose();
});
test('detail failures keep map/results usable and retry is explicit; new search and unmount discard pending details',async()=>{
  let calls=0;const pendingDetails=deferred();
  const explorer=createMapExplorer(async()=>({search:async()=>[place],select(){},details:async()=>{calls++;if(calls===1)throw Error('private token');return pendingDetails.promise;},dispose(){}}));
  await explorer.open(host());await explorer.search('場所');await explorer.select(place.id);assert.equal(explorer.getSnapshot().phase,'ready');assert.equal(explorer.getSnapshot().detailStatus,'error');assert.equal(explorer.getSnapshot().results.length,1);assert.equal(explorer.getSnapshot().error,null);
  const pending=explorer.select(place.id);assert.equal(calls,2);await explorer.search('別の検索');pendingDetails.resolve(noDetails);await pending;
  assert.equal(explorer.getSnapshot().details,null);assert.equal(explorer.getSnapshot().selected,null);assert.equal(explorer.getSnapshot().detailStatus,'idle');explorer.dispose();
});
test('aborted or unmounted detail fetches never produce a photo URL or issue extra photo requests',async()=>{
  for(const cancel of ['abort','dispose']){
    let photos=0;const details=deferred();const fake=fakeSDK({fetchDetails:()=>details.promise});const session=await fake.start(host(),config,()=>{});
    const aborter=new AbortController(),pending=session.details(place,aborter.signal);await flush();
    if(cancel==='abort')aborter.abort();else session.dispose();
    details.resolve({photos:[{googleMapsURI:'https://www.google.com/maps/photo/synthetic',getURI(){photos++;return 'https://example.com/photo';}}]});
    await assert.rejects(pending,/maps_unavailable/);assert.equal(photos,0);assert.equal(fake.detailRequests.length,1);session.dispose();
  }
});
test('only one photo is requested and individual source/author links are required and sanitized',()=>{
  let photoRequests=0;
  const raw={rating:4.4,userRatingCount:120,photos:Array.from({length:10},(_,i)=>({googleMapsURI:`https://www.google.com/maps/photo/${i}`,authorAttributions:[{displayName:'撮影者',uri:'https://example.com/author',photoURI:'https://example.com/avatar'}],getURI(options){photoRequests++;assert.deepEqual(options,{maxWidth:800,maxHeight:800});return `https://example.com/photo/${i}`;}})),reviews:[
    {text:'<script>bad</script>',originalText:'original text',rating:5,googleMapsURI:'https://www.google.com/maps/review/one',authorAttribution:{displayName:'<投稿者>',uri:'javascript:bad',photoURI:'data:bad'}},
    {text:'missing source',authorAttribution:{displayName:'投稿者'}},
    {text:'bad source',googleMapsURI:'javascript:bad',authorAttribution:{displayName:'投稿者'}},
  ],attributions:[{provider:'<provider>',providerURI:'javascript:bad'}]};
  const result=detailResult(raw);assert.equal(photoRequests,1);assert.equal(result.photo.uri,'https://example.com/photo/0');assert.equal(result.photo.authors[0].name,'撮影者');assert.equal(result.reviews.length,1);assert.equal(result.reviews[0].author.uri,null);assert.equal(result.reviews[0].author.avatar,null);assert.equal(result.reviews[0].original,'original text');assert.equal(result.attributions[0].uri,null);
  const markup=renderToStaticMarkup(createElement(PlaceDetailPanel,{place,details:result,status:'ready',onRetry(){}}));
  assert.ok(markup.includes('https://example.com/photo/0'));assert.ok(!markup.includes('/_next/image'));assert.match(markup,/撮影者/);assert.match(markup,/Google Maps/);assert.match(markup,/Googleによる翻訳/);assert.match(markup,/原文を見る/);
  assert.ok(markup.includes('https://www.google.com/maps/review/one'));assert.ok(markup.includes('https://www.google.com/maps/photo/0'));assert.ok(!markup.includes('<script>'));assert.ok(!markup.includes('javascript:'));assert.ok(markup.includes('&lt;投稿者&gt;'));
});
test('missing media, loading and failed details remain distinct and retain the external Maps path',()=>{
  for(const status of ['loading','error','ready']){
    const markup=renderToStaticMarkup(createElement(PlaceDetailPanel,{place,details:status==='ready'?noDetails:null,status,onRetry(){}}));
    assert.ok(markup.includes('https://www.google.com/maps/search/'));
    if(status==='loading')assert.match(markup,/読み込んでいます/);
    if(status==='error'){assert.match(markup,/もう一度読み込む/);assert.match(markup,/role="alert"/);}
    if(status==='ready'){assert.match(markup,/ここで表示できる写真はありません/);assert.match(markup,/ここで表示できる口コミはありません/);assert.ok(!markup.includes('0件の評価'));}
  }
});
