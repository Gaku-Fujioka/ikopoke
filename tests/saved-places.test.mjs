import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const moduleURL=s=>`data:text/javascript,${encodeURIComponent(s)}`;
const provider=moduleURL(`export let config={};export const calls=[];export function configure(c){config=c;calls.length=0;}export async function createClient(){return {auth:{getClaims:async()=>({data:config.signedOut?null:{claims:{sub:'synthetic'}},error:null})},rpc:async(name,args)=>{calls.push([name,args]);return config.result??{data:[{item_id:'20000000-0000-4000-8000-000000000001',reused:false,archived:false}],error:null};}};}export function revalidatePath(...args){calls.push(['path',...args]);}export function revalidateSharedHome(...args){calls.push(['home',...args]);}export async function listLists(){return {lists:[{id:'80000000-0000-4000-8000-000000000001',name:'リスト',created_by:'must-not-leak'}],total:1};}`);
registerHooks({resolve(specifier,context,next){
 if(['@/lib/supabase/server','next/cache','@/lib/home/revalidate','@/lib/lists/repository'].includes(specifier))return {url:provider,shortCircuit:true};
 if(specifier==='react'&&context.parentURL?.startsWith('data:'))return next(specifier,{...context,parentURL:import.meta.url});
 if(specifier==='next/link')return {url:moduleURL("import {createElement} from 'react';export default function Link(p){return createElement('a',p);}"),shortCircuit:true};
 if(specifier.startsWith('@/')||(specifier.startsWith('./')&&/\.tsx?$/.test(context.parentURL??''))){const base=specifier.startsWith('@/')?new URL(`../${specifier.slice(2)}`,import.meta.url):new URL(specifier,context.parentURL);const url=['.ts','.tsx'].map(ext=>base.href+ext).find(url=>existsSync(fileURLToPath(url)));if(url)return {url,shortCircuit:true};}
 return next(specifier,context);
},load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(url,context);}});
const {parsePlaceSave,directionsHref,mapCandidates}=await import('../lib/maps/saved.ts');
const {savePlaceAction,attachPlaceAction,placeListsAction}=await import('../app/app/map-actions.ts');
const {SavedPlacesMap}=await import('../components/maps/saved-places-map.tsx');
const {SearchWorkspace}=await import('../components/maps/search-workspace.tsx');
const {configure,calls}=await import(provider);
const group='10000000-0000-4000-8000-000000000001',item='20000000-0000-4000-8000-000000000001',request='70000000-0000-4000-8000-000000000001',list='80000000-0000-4000-8000-000000000001';
function form(extra={}){const f=new FormData();for(const [k,v] of Object.entries({groupId:group,requestId:request,placeId:'ChIJ_safe',title:' 自分の呼び名 ',...extra}))f.set(k,v);return f;}
const config={enabled:true,placesEnabled:true,apiKey:'synthetic',mapId:'synthetic'};
test('place input accepts only identifiers and user labels, never forwards provider content',()=>{
 const f=form({photo:'private photo URI',latitude:'35',memo:'provider data'});f.append('listIds',list);f.append('listIds',list);assert.deepEqual(parsePlaceSave(f),{groupId:group,requestId:request,placeId:'ChIJ_safe',title:'自分の呼び名',listIds:[list]});
 for(const change of [{title:' '},{title:'あ'.repeat(101)},{placeId:'https://example.com'},{groupId:'bad'}])assert.throws(()=>parsePlaceSave(form(change)));
});
test('save action requires auth, uses one atomic RPC and revalidates only after success',async()=>{
 configure({signedOut:true});assert.match((await savePlaceAction({error:null},form())).error,/ログイン/);assert.equal(calls.length,0);
 configure({});const result=await savePlaceAction({error:null},form());assert.equal(result.itemId,item);assert.equal(calls.filter(c=>c[0]==='save_place_item').length,1);assert.equal(calls[0][1].p_title,'自分の呼び名');assert.ok(calls.some(c=>c[0]==='home'));
 configure({result:{data:null,error:{code:'40001',message:'secret provider error'}}});assert.match((await savePlaceAction({error:null},form())).error,/別の画面/);assert.equal(calls.length,1);
 configure({});const lists=await placeListsAction(group);assert.deepEqual(lists.lists,[{id:list,name:'リスト'}]);
});
test('attach validates expected identifier and keeps conflict errors safe',async()=>{
 configure({});const invalid=await attachPlaceAction({error:null},form({itemId:item,expectedPlaceId:'bad/url'}));assert.ok(invalid.error);assert.equal(calls.length,0);
 const success=await attachPlaceAction({error:null},form({itemId:item,placeId:'',expectedPlaceId:'ChIJ_before'}));assert.equal(success.itemId,item);assert.equal(calls[0][1].p_place_id,null);assert.equal(calls[0][1].p_expected_place_id,'ChIJ_before');
});
test('saved candidate projection scopes queries and excludes archived/activity entries',async()=>{
 const seen=[];const client={from(table){const query={};for(const method of ['select','order','range','eq','in','is'])query[method]=(...args)=>{seen.push([table,method,...args]);return query;};query.then=resolve=>resolve(table==='item_places'?{data:[{item_id:item,group_id:group,place_id:'ChIJ_safe'}],error:null}:{data:[{id:item,group_id:group,title:'自分の呼び名',kind:'spot'}],error:null});return query;}};
 assert.deepEqual(await mapCandidates(client,group),[{itemId:item,groupId:group,title:'自分の呼び名',placeId:'ChIJ_safe'}]);assert.ok(seen.some(c=>c[0]==='item_places'&&c[1]==='eq'&&c[2]==='group_id'&&c[3]===group));assert.ok(seen.some(c=>c[0]==='items'&&c[1]==='is'&&c[2]==='archived_at'));
 seen.length=0;await mapCandidates(client,group,[item,item]);assert.ok(!seen.some(c=>c[1]==='is'));assert.deepEqual(seen.find(c=>c[0]==='item_places'&&c[1]==='in')[3],[item]);
});
test('saved maps stay closed initially, keep repeated stops, and link directions by place ID',()=>{
 const row={itemId:item,groupId:group,title:'朝も夜も',placeId:'ChIJ_safe'};
 const html=renderToStaticMarkup(createElement(SavedPlacesMap,{candidates:[row,row],groups:[{id:group,name:'友達'}],config,ordered:true}));assert.match(html,/保存した場所を地図に表示/);assert.equal((html.match(/朝も夜も/g)??[]).length>=2,true);assert.match(html,/destination_place_id=ChIJ_safe/);assert.match(html,/hidden/);assert.ok(!html.includes('maps.googleapis.com'));
 const uri=new URL(directionsHref('ChIJ_safe','カフェ & 公園'));assert.equal(uri.searchParams.get('destination'),'カフェ & 公園');assert.equal(uri.searchParams.get('destination_place_id'),'ChIJ_safe');
 const tree=SearchWorkspace({config,groups:[{id:group,name:'友達'}]});const save=tree.props.renderPlaceAction({id:'ChIJ_safe',name:'provider name'},'自分の検索語');assert.equal(save.props.query,'自分の検索語');assert.ok(!JSON.stringify(save.props).includes('defaultTitle'));
});
