import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";
import { createElement, Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const sourceURL=source=>`data:text/javascript,${encodeURIComponent(source)}`;
const providerURL=sourceURL(`
export let config={};export const calls=[];export function configure(value){config=value;calls.length=0;}
export function usePathname(){return config.pathname??'/app';}
export function useSearchParams(){return new URLSearchParams(config.search??'');}
export async function createClient(){return {auth:{getClaims:async()=>{calls.push('auth');return {data:config.signedOut?null:{claims:{sub:'synthetic'}},error:null};}}};}
export async function listGroups(){calls.push('groups');if(config.groupError)throw Error('private');return config.groups??[];}
export async function getGroup(client,id){return config.groups?.find(group=>group.id===id)??null;}
export async function getGroupMembers(){return [{user_id:'synthetic',display_name:'参加者'}];}
export async function getOuting(){const c=config.current;if(!c)return c;return {...c,outing:{...c.outing,end_date:c.outing.end_date??c.outing.outing_date},items:c.items.map((s,index)=>({...s,id:s.id??"stop-"+index,day_index:s.day_index??0})),days:c.days??[{day_index:0,mode:c.outing.mode,participants:c.participants}]};}
export async function getMemory(){return config.memory;}export async function getMemoryContent(){return {visits:[],photos:[]};}
export async function listCandidateOptions(){return [{id:'candidate',title:'訪問先',kind:'spot'}];}
export async function getActivity(client,group){calls.push(['activity',group]);if(config.activityError)throw Error('private');return config.activity??[];}
export async function nextOuting(client,group){calls.push(['next',group]);return config.next??null;}
export async function recentCandidates(client,group){calls.push(['recent',group]);return [];}
export class HomeStoreError extends Error{};
export async function globalItems(){return {rows:[],total:0};}export async function globalOutings(){return {rows:[],total:0};}export async function globalMemories(){return {rows:[],total:0};}
`);
const navigationURL=sourceURL(`export {usePathname,useSearchParams} from ${JSON.stringify(providerURL)};export function notFound(){throw Object.assign(Error('not found'),{navigation:'not-found'});}export function redirect(location){throw Object.assign(Error('redirect'),{location});}`);
registerHooks({
  resolve(specifier,context,next){
    if(specifier==='react'&&context.parentURL?.startsWith('data:'))return next(specifier,{...context,parentURL:import.meta.url});
    if(specifier==='@/lib/utils')return {url:sourceURL("export const hasEnvVars=true;"),shortCircuit:true};
    if(['@/lib/supabase/server','@/lib/groups/repository','@/lib/home/repository','@/lib/profiles/repository','@/lib/outings/repository','@/lib/memories/repository'].includes(specifier))return {url:providerURL,shortCircuit:true};
    if(['@/components/outings/outing-form','@/components/visits/visit-sections','@/components/memories/memory-forms','@/components/memories/cover-editor','@/components/memories/memory-book'].includes(specifier))return {url:sourceURL('export function CoverEditor(){return null;}export function MemoryBook(){return null;}export function MemoryEditForm(){return null;}export function OutingCancellation(){return null;}export function OutingForm(){return null;}export function VisitHistory(){return null;}export function CompletionForm(){return null;}'),shortCircuit:true};
    if(specifier==='next/navigation')return {url:navigationURL,shortCircuit:true};
    if(specifier==='next/link')return {url:sourceURL("import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{...props,href},children);}"),shortCircuit:true};
    if(specifier==='@/components/home/refresh-button'||specifier==='./refresh-button')return {url:sourceURL("export function RefreshButton(){return '更新';}"),shortCircuit:true};
    if(specifier.startsWith('@/') || ((specifier.startsWith('./')||specifier.startsWith('../'))&&/\.tsx?$/.test(context.parentURL??''))){
      const base=specifier.startsWith('@/')?new URL(`../${specifier.slice(2)}`,import.meta.url):new URL(specifier,context.parentURL);
      const url=['.ts','.tsx'].map(extension=>base.href+extension).find(value=>existsSync(fileURLToPath(value)));
      if(url)return {url,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const provider=await import(providerURL);
const {SharedHome}=await import('../components/home/shared-home.tsx');
const {ActivityCards}=await import('../components/home/activity-cards.tsx');
const {AppNav}=await import('../components/layout/app-nav.tsx');
const {default:OutingPage}=await import('../app/app/groups/[groupId]/outings/[outingId]/page.tsx');
const groupId='10000000-0000-4000-8000-000000000001',otherId='10000000-0000-4000-8000-000000000002';
const groups=[{id:groupId,name:'友達',created_at:'2026-10-18'},{id:otherId,name:'家族',created_at:'2026-10-18'}];
const entry={event_key:'a'.repeat(32),group_id:groupId,kind:'want_to_go',subject_id:'20000000-0000-4000-8000-000000000001',title:'カフェ',actor_name:'はる',is_mine:false,occurred_at:'2026-10-18T03:00:00Z'};
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return [];return [...(!Array.isArray(tree)&&predicate(tree)?[tree]:[]),...(Array.isArray(tree)?tree:[tree.props?.children]).flatMap(child=>nodes(child,predicate))];}
beforeEach(()=>provider.configure({groups}));

test('real home orders groups, next outing, map and activity with independent read boundaries',async()=>{
  const tree=await SharedHome({});
  assert.deepEqual(provider.calls,['auth','groups']);
  const children=tree.props.children.flatMap(child=>child?.type===Symbol.for('react.fragment')?child.props.children:child).flat(Infinity).filter(Boolean);
  assert.equal(children[1].type.name,'GroupCards');
  assert.equal(children[2].type,Suspense);assert.equal(children[2].props.children.type.name,'NextEnjoyment');
  assert.equal(children[3].type.name,'MapSpace');assert.equal(children[4].props['aria-labelledby'],'home-activity-title');
  const boundary=nodes(children[4],node=>node.type===Suspense)[0];
  provider.configure({groups,activityError:true});
  const error=await boundary.props.children.type(boundary.props.children.props);
  const markup=renderToStaticMarkup(error);assert.match(markup,/読み込めませんでした/);assert.ok(!markup.includes('private'));
});
test('signed-out and non-member home requests stop before fetching sensitive sections',async()=>{
  provider.configure({signedOut:true});await assert.rejects(SharedHome({groupId}),error=>error.location.includes('/auth/login?next='));assert.deepEqual(provider.calls,['auth']);
  provider.configure({groups:[]});await assert.rejects(SharedHome({groupId}),error=>error.navigation==='not-found');assert.deepEqual(provider.calls,['auth','groups']);
});
test('scoped home gives each independent read the same selected group',async()=>{
  const tree=await SharedHome({groupId});
  const parts=nodes(tree,node=>node.props?.groupId!==undefined);
  assert.ok(parts.length>=3);assert.ok(parts.every(node=>node.props.groupId===groupId));
});
test('four bottom tabs stay inside the current group and add links carry the correct destination',()=>{
  provider.configure({pathname:`/app/groups/${groupId}/items/example`});
  const markup=renderToStaticMarkup(createElement(AppNav));
  for(const suffix of ['', '/items','/outings','/memories'])assert.ok(markup.includes(`href="/app/groups/${groupId}${suffix}"`));
  assert.match(markup,/aria-current="page"[^>]*class="kk-tab"/);
  for(const type of ['item','outing','visit'])assert.ok(markup.includes(`href="/app/new?type=${type}&amp;group=${groupId}"`));
  assert.match(markup,/<dialog[^>]+aria-labelledby="quick-add-title"/);
  provider.configure({pathname:'/app'});const global=renderToStaticMarkup(createElement(AppNav));assert.ok(global.includes('href="/app/new?type=item"'));assert.ok(!global.includes(`group=${groupId}`));
});
test('activity density switches at five, cards navigate to actual group content, and expanded feed keeps full text',()=>{
  for(const count of [4,5,12]){
    const entries=Array.from({length:count},(_,n)=>({...entry,event_key:String(n).padStart(32,'0')}));
    const tree=ActivityCards({entries,groups});assert.equal(tree.props.className.includes('busy'),count>4);
    const markup=renderToStaticMarkup(tree);assert.ok(markup.includes(`href="/app/groups/${groupId}/items/${entry.subject_id}"`));assert.match(markup,/はる · カフェ · 行きたい！ · 友達/);assert.ok(!markup.includes('20000000-0000-4000-8000-000000000001@example'));
    assert.equal(ActivityCards({entries,groups,expanded:true}).props.className,'kk-activity-list');
  }
});

test('outing detail leads with the saved itinerary and visit actions; editing is optional and preserves all three modes',async()=>{
  for(const mode of ['exact','period','order']){
    provider.configure({groups,current:{outing:{title:'おでかけ',outing_date:'2026-10-18',mode,completed_at:null,revision:1,memo:'共有メモ'},items:[{item_id:'candidate',position:0,planned_time:'10:15',period:'morning'}],participants:['synthetic']}});
    const tree=OutingPage({params:Promise.resolve({groupId,outingId:'30000000-0000-4000-8000-000000000001'})});
    const boundary=nodes(tree,node=>node.type===Suspense)[0],body=await boundary.props.children.type(boundary.props.children.props);
    const sections=nodes(body,node=>node.type==='section');assert.equal(sections[0].props['aria-label'],'日付と参加者');assert.equal(sections[1].props['aria-label'],'1日目のプラン');
    const edit=nodes(body,node=>node.type==='details')[0];assert.equal(edit.props.id,'edit-plan');assert.notEqual(edit.props.open,true);
    const links=nodes(sections[1],node=>typeof node.props?.href==='string');assert.ok(links.some(link=>link.props.href.includes('/visits/new?item=candidate&outing=')));
    const markup=renderToStaticMarkup(sections[1]);if(mode==='exact')assert.ok(markup.includes('10:15'));if(mode==='period')assert.ok(markup.includes('午前'));if(mode==='order')assert.ok(!markup.includes('10:15'));
  }
});

const {default:MemoryPage}=await import('../app/app/groups/[groupId]/memories/[memoryId]/page.tsx');
for(const cancelled of [true,false])test(`album ${cancelled?'cancelled':'active'} controls match the plan state while preserving the book and cover editor`,async()=>{
  const outingId='30000000-0000-4000-8000-000000000001',memoryId='90000000-0000-4000-8000-000000000001';
  provider.configure({groups,memory:{id:memoryId,group_id:groupId,outing_id:outingId,title:'旅の思い出',revision:1},current:{outing:{id:outingId,outing_date:'2026-10-18',mode:'order',revision:2,completed_at:null,cancelled_at:cancelled?'2026-10-18T00:00:00Z':null},items:[],participants:[]}});
  const page=MemoryPage({params:Promise.resolve({groupId,memoryId})}),outer=nodes(page,n=>n.type===Suspense)[0];
  const content=await outer.props.children.type(outer.props.children.props),bookBoundary=nodes(content,n=>n.type===Suspense)[0],book=await bookBoundary.props.children.type(bookBoundary.props.children.props);
  const controls=nodes(book,n=>n.type?.name==='CompletionForm');assert.equal(controls.length,cancelled?0:1);
  assert.equal(nodes(book,n=>n.type?.name==='MemoryBook').length,1);assert.equal(nodes(book,n=>n.type?.name==='CoverEditor').length,1);
  if(cancelled){const paragraphs=nodes(book,n=>n.type==='p').map(n=>n.props.children).join('');assert.match(paragraphs,/中止中/);assert.ok(nodes(book,n=>n.props?.href===`/app/groups/${groupId}/outings/${outingId}`).length);}
});
