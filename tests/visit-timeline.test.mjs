import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const source=s=>`data:text/javascript,${encodeURIComponent(s)}`;
registerHooks({resolve(s,c,next){
  if(s==='react'&&c.parentURL?.startsWith('data:'))return next(s,{...c,parentURL:import.meta.url});
  if(s==='next/link')return {url:source("import {createElement} from 'react';export default function Link({href,children,...p}){return createElement('a',{...p,href},children);}"),shortCircuit:true};
  if(s==='@/components/visits/private-visit-image')return {url:source("import {createElement} from 'react';export function PrivatePhotoPreview({path,alt}){return createElement('span',{'data-private-photo':path,role:'img','aria-label':alt});}"),shortCircuit:true};
  if(s.startsWith('@/')||(s.startsWith('./')&&/\.tsx?$/.test(c.parentURL??''))){const base=s.startsWith('@/')?new URL('../'+s.slice(2),import.meta.url):new URL(s,c.parentURL);const url=['.ts','.tsx'].map(ext=>base.href+ext).find(url=>existsSync(fileURLToPath(url)));if(url)return {url,shortCircuit:true};}
  return next(s,c);
},load(url,c,next){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,c);}});
const {listVisitSummaries}=await import('../lib/visits/repository.ts');
const {VisitTimeline}=await import('../components/visits/visit-timeline.tsx');
const {MemoryNavigation}=await import('../components/memories/memory-navigation.tsx');
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const rows=Array.from({length:23},(_,i)=>({id:String(i),group_id:i===0?b:a,item_title:`場所${i}`,visited_on:i<2?'2026-10-21':'2026-10-20',created_at:String(100-i),note:i?'ひとこと':'',visited_time:null,visited_period:null}));
const photos=[{group_id:a,visit_id:'1',object_path:'second',content_type:'image/jpeg',status:'ready',display_order:2},{group_id:a,visit_id:'1',object_path:'first',content_type:'image/png',status:'ready',display_order:1},{group_id:a,visit_id:'1',object_path:'pending',status:'pending'},{group_id:b,visit_id:'0',object_path:'other',status:'ready',display_order:1}];
function fixture({failPhotos=false}={}){const calls=[];return {calls,from(table){let data=(table==='visits'?rows:photos).slice(),count=0;const q={select(...args){calls.push([table,'select',...args]);return q;},eq(k,v){calls.push([table,'eq',k,v]);data=data.filter(r=>r[k]===v);return q;},in(k,v){calls.push([table,'in',k,v]);data=data.filter(r=>v.includes(r[k]));return q;},order(k,{ascending=true}={}){calls.push([table,'order',k,ascending]);if(table==='visit_photos'&&k==='display_order')data.sort((a,b)=>a[k]-b[k]);return q;},range(start,end){calls.push([table,'range',start,end]);count=data.length;return Promise.resolve({data:data.slice(start,end+1),count,error:null});},limit(n){calls.push([table,'limit',n]);return Promise.resolve({data:data.slice(0,n),error:failPhotos?{code:'42501',message:'private'}:null});}};return q;}};}
test('group timeline pages visits and loads ready photos in one bounded query; display order chooses the preview',async()=>{
  const client=fixture();const result=await listVisitSummaries(client,a);
  assert.equal(result.total,22);assert.equal(result.visits.length,20);assert.equal(result.visits[0].preview.object_path,'first');assert.equal(result.visits[0].photoCount,2);
  assert.ok(result.visits.every(row=>row.group_id===a));
  assert.equal(client.calls.filter(c=>c[0]==='visit_photos'&&c[1]==='select').length,1);
  assert.ok(client.calls.some(c=>c[1]==='in'&&c[2]==='visit_id'&&c[3].length===20));
  assert.ok(client.calls.some(c=>c[1]==='limit'&&c[2]===200));
  assert.equal((await listVisitSummaries(fixture(),a,2)).visits.length,2);
});
test('global timeline uses the session-scoped visit query; empty pages skip photos and a photo failure keeps visits',async()=>{
  const global=fixture();const result=await listVisitSummaries(global,null);
  assert.equal(result.visits[0].group_id,b);assert.equal(result.visits[0].preview.object_path,'other');
  assert.ok(!global.calls.some(c=>c[0]==='visits'&&c[1]==='eq'&&c[2]==='group_id'));
  const empty=fixture();assert.equal((await listVisitSummaries(empty,a,9)).visits.length,0);assert.ok(!empty.calls.some(c=>c[0]==='visit_photos'));
  const failed=await listVisitSummaries(fixture({failPhotos:true}),a);assert.equal(failed.photosUnavailable,true);assert.equal(failed.visits.length,20);assert.equal(failed.visits[0].photoCount,null);
});
test('timeline groups by date, uses private previews, handles missing photos and links to each visit',async()=>{
  const result=await listVisitSummaries(fixture(),null);const markup=renderToStaticMarkup(createElement(VisitTimeline,{visits:result.visits,groups:[{id:a,name:'友達',presentation:{color:'mint'}},{id:b,name:'家族'}]}));
  assert.equal((markup.match(/class="kk-visit-day"/g)??[]).length,2);assert.match(markup,/写真 2枚/);assert.match(markup,/写真 0枚/);assert.match(markup,/data-private-photo="first"/);
  assert.ok(markup.includes(`/app/groups/${a}/visits/1`));assert.match(markup,/友達/);assert.match(markup,/家族/);assert.ok(!markup.includes('pending'));
});
test('memory switch always exposes both views, current state and direct recording for global and group scopes',()=>{
  for(const groupId of [undefined,a])for(const active of ['albums','visits']){
    const markup=renderToStaticMarkup(createElement(MemoryNavigation,{groupId,active}));
    assert.match(markup,/アルバム/);assert.match(markup,/訪問記録/);assert.equal((markup.match(/aria-current="page"/g)??[]).length,1);
    assert.ok(markup.includes(groupId?`/app/groups/${a}/visits`:'/app/memories?view=visits'));
    assert.ok(markup.includes(groupId?`/app/new?type=visit&amp;group=${a}`:'/app/new?type=visit'));
  }
});
