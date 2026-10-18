import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const moduleURL = source => `data:text/javascript,${encodeURIComponent(source)}`;
const actions = moduleURL('export async function saveTripAction(){return {error:null};}export async function cancelOutingAction(){return {error:null};}export async function createItemAction(){return {error:null};}export async function updateItemAction(){return {error:null};}export async function setReactionAction(){return {error:null};}');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' && context.parentURL?.startsWith('data:')) return next(specifier, { ...context, parentURL: import.meta.url });
    if (specifier.startsWith('@/app/')) return { url: actions, shortCircuit: true };
    if (specifier === 'next/link') return { url: moduleURL("import {createElement} from 'react';export default function Link(props){return createElement('a',props);}"), shortCircuit: true };
    if (specifier === 'next/navigation') return { url: moduleURL("export function usePathname(){return '/app';}export function useRouter(){return {replace(){}};}"), shortCircuit: true };
    if (specifier.startsWith('@/') || (specifier.startsWith('./') && /\.tsx?$/.test(context.parentURL ?? ''))) {
      const base = specifier.startsWith('@/') ? new URL(`../${specifier.slice(2)}`, import.meta.url) : new URL(specifier, context.parentURL);
      const url = ['.ts', '.tsx'].map(ext => base.href + ext).find(url => existsSync(fileURLToPath(url)));
      if (url) return { url, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
const { OutingForm } = await import('../components/outings/outing-form.tsx');
const { CreateItemForm } = await import('../components/items/create-item-form.tsx');
const { EditItemForm } = await import('../components/items/edit-item-form.tsx');
const { QuickReaction } = await import('../components/items/quick-reaction.tsx');
const { CandidateBoard } = await import('../components/items/candidate-board.tsx');
const { selectedCandidateIds, availableSelection } = await import('../lib/outings/selection.ts');
const { parseTrip } = await import('../lib/outings/trips.ts');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const groupId=id(1), outingId=id(2), actorId=id(3), candidate=id(4), another=id(5);
const members=[{user_id:actorId,display_name:'はる'}];
const candidates=[{id:candidate,title:'海辺のカフェ',kind:'spot',archived_at:null},{id:another,title:'公園',kind:'spot',archived_at:null}];
const current={outing:{id:outingId,title:'週末の旅',outing_date:'2026-10-20',end_date:'2026-10-21',memo:'集合場所',revision:7},participants:[actorId],days:[{day_index:0,mode:'exact',participants:[actorId]},{day_index:1,mode:'period',participants:[actorId]}],items:[{id:id(10),day_index:0,item_id:candidate,planned_time:'10:15:00',period:'morning'},{id:id(11),day_index:1,item_id:candidate,planned_time:'11:00:00',period:'noon'}]};
const props={groupId,outingId,actorId,members,candidates,current};
const render=(component,props)=>renderToStaticMarkup(createElement(component,props));
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function hidden(markup,name){const tag=[...markup.matchAll(/<input\b[^>]*>/g)].map(m=>m[0]).find(tag=>tag.includes(`name="${name}"`));return decode(tag?.match(/value="([^"]*)"/)?.[1]??'');}

test('candidate selection URLs are bounded and filter archived or other-group IDs before opening a draft',()=>{
  assert.deepEqual(selectedCandidateIds(`${candidate},${another},${candidate}`),[candidate,another]);
  for(const invalid of [[],null,'bad',Array(51).fill(candidate).join(',')])assert.deepEqual(selectedCandidateIds(invalid),[]);
  assert.deepEqual(availableSelection([candidate,another,id(999)],[candidates[0],{...candidates[1],archived_at:'date'}]),[candidate]);
});
test('partial plan editors serialize all hidden days, people and times without reducing the existing trip',()=>{
  for(const section of ['title','memo','dates','participants','day']){
    const markup=render(OutingForm,{...props,section,initialDay:1});
    const form=new FormData();
    for(const [key,value] of Object.entries({groupId,outingId,expectedRevision:'7',title:'週末の旅',start:'2026-10-20',end:'2026-10-21',memo:'集合場所',days:hidden(markup,'days'),participants:hidden(markup,'participants'),removedIds:hidden(markup,'removedIds')}))form.set(key,value);
    const input=parseTrip(form);assert.equal(input.expectedRevision,7);assert.equal(input.days.length,2);assert.equal(input.days[0].items[0].id,id(10));assert.equal(input.days[0].items[0].planned_time,'10:15');assert.equal(input.days[1].mode,'period');assert.equal(input.days[1].items[0].period,'noon');assert.deepEqual(input.days[1].participants,[actorId]);
    if(section==='title'){assert.match(markup,/type="hidden" name="start"/);assert.ok(!markup.includes('日ごとのプラン'));}
    if(section==='memo')assert.match(markup,/type="hidden" name="title"/);
  }
});
test('existing-plan additions target the selected day, retain stop IDs and hidden times and remain unsaved drafts',()=>{
  const markup=render(OutingForm,{...props,section:'day',initialDay:1,initialItemIds:[candidate,another],draftId:id(100)}),days=JSON.parse(hidden(markup,'days'));
  assert.equal(days[0].items.length,1);assert.equal(days[1].items.length,3);assert.equal(days[1].items[0].id,id(11));assert.equal(days[1].items[0].planned_time,'11:00');assert.deepEqual(days[1].items.slice(1).map(s=>s.item_id),[candidate,another]);
  assert.equal(new Set(days.flatMap(d=>d.items.map(s=>s.id))).size,4);assert.match(markup,/まだ保存されていません/);assert.equal(hidden(markup,'expectedRevision'),'7');
  // Period mode requires explicit times for newly added stops, not guessed defaults.
  assert.equal(days[1].items[1].period,null);assert.match(markup,/<select required=""/);
});
test('new outing shows dates, participants, itinerary and all modes on one screen with multiple initial candidates',()=>{
  const markup=render(OutingForm,{...props,current:null,initialItemIds:[candidate,another]});
  for(const label of ['開始日','終了日','誰と行く？','日ごとのプラン','時刻指定','時間帯','時間なし'])assert.ok(markup.includes(label),label);
  assert.equal(JSON.parse(hidden(markup,'days'))[0].items.length,2);assert.equal(hidden(markup,'expectedRevision'),'0');
});
test('candidate creation exposes name and kind while memo and multiple list choices share an optional disclosure',()=>{
  const markup=render(CreateItemForm,{groupId,groupName:'友達',requestId:id(20),lists:[{id:id(21),name:'カフェ'},{id:id(22),name:'東京'}]});
  assert.match(markup,/name="title"/);assert.match(markup,/name="kind"/);
  const extra=markup.slice(markup.indexOf('<details'),markup.indexOf('</details>'));
  assert.ok(extra.includes('name="memo"'));assert.equal((extra.match(/name="listIds"/g)??[]).length,2);assert.ok(!extra.includes('<details open'));
});
test('item name and memo editors show only the requested field and carry optimistic baselines with unique labels',()=>{
  const base={groupId,itemId:candidate,title:'候補',memo:'元のメモ'};
  const title=render(EditItemForm,{...base,field:'title'}),memo=render(EditItemForm,{...base,field:'memo'});
  assert.match(title,/type="hidden" name="memo" value="元のメモ"/);assert.ok(!title.includes('<textarea'));
  assert.match(memo,/type="hidden" name="title" value="候補"/);assert.match(memo,/name="expectedTitle" value="候補"/);assert.match(memo,/name="expectedMemo" value="元のメモ"/);
  const ids=[...`${title}${memo}`.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});
test('list reactions carry the correct candidate and toggle a selected reaction to clear without touching others',()=>{
  const markup=render(QuickReaction,{groupId,itemId:candidate,title:'候補',value:'want_to_go',count:2});
  assert.equal(hidden(markup,'groupId'),groupId);assert.equal(hidden(markup,'itemId'),candidate);assert.match(markup,/value="clear" aria-pressed="true"/);assert.match(markup,/value="not_now" aria-pressed="false"/);
  const board=render(CandidateBoard,{groupId,items:[{...candidates[0],group_id:groupId,memo:'海が見える',my_reaction:'want_to_go',want_count:2}],links:{[candidate]:'/detail?keep=1'}});
  assert.match(board,/href="\/detail\?keep=1"/);assert.ok(!/<a[^>]*>[\s\S]*?<form[\s\S]*?<\/a>/.test(board));assert.match(board,/type="checkbox"/);
});
