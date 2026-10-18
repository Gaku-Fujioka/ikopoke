import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
import {test,beforeEach} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const url=s=>`data:text/javascript,${encodeURIComponent(s)}`;
const provider=url(`export const calls=[];let config={};export function configure(c){config=c;calls.length=0;}export class FinanceError extends Error{constructor(){super('安全なエラー');}}export async function financeSession(){calls.push('auth');if(config.signedOut)throw Object.assign(Error('redirect'),{location:'/auth/login'});return {};}
export async function financeOptions(client,id){calls.push(['options',id]);if(config.fail)throw new FinanceError();return {...config.options,context:id?config.options.context:null};}
export async function financeDashboard(client,q){calls.push(['dashboard',q]);if(config.fail)throw new FinanceError();return config.dashboard;}
export async function financeDetail(client,id,page){calls.push(['detail',id,page]);return config.detail;}`);
const actions=url(`export async function saveFinanceEntryAction(){return {error:null};}export async function saveFinancePaymentAction(){return {error:null};}export async function deleteFinanceEntryAction(){return {error:null};}export async function saveFinanceCategoryAction(){return {error:null};}`);
registerHooks({resolve(s,c,next){
 if(s==='react'&&c.parentURL?.startsWith('data:'))return next(s,{...c,parentURL:import.meta.url});
 if(['@/lib/finance/session','@/lib/finance/repository'].includes(s))return {url:provider,shortCircuit:true};
 if(s==='@/app/app/finance/actions')return {url:actions,shortCircuit:true};
 if(s==='next/link')return {url:url("import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{href,...props},children);}"),shortCircuit:true};
 if(s==='next/navigation')return {url:url("export function redirect(location){throw Object.assign(Error('redirect'),{location});}"),shortCircuit:true};
 if(s.startsWith('@/')){const root=new URL('../'+s.slice(2),import.meta.url);const found=['.ts','.tsx'].map(ext=>root.href+ext).find(v=>existsSync(fileURLToPath(v)));if(found)return {url:found,shortCircuit:true};}
 return next(s,c);
},load(p,c,next){if(p.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(p),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(p,c);}});
const backend=await import(provider),{default:Dashboard}=await import('../app/app/finance/page.tsx'),{default:New}=await import('../app/app/finance/new/page.tsx'),{default:Detail}=await import('../app/app/finance/entries/[entryId]/page.tsx');
const {FinanceEntryForm,FinanceDeleteEntry}=await import('../components/finance/forms.tsx');
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context={id:id(1),kind:'outing',source_id:id(2),group_id:id(3),outing_id:id(2),group_name:'友達',title:'旅',outing_title:'旅',occurred_on:'2026-10-18',created_at:'2026-10-18',accessible:true};
const entry={id:id(4),context_id:id(1),kind:'pay',title:'チケット',amount:1000,occurred_on:'2026-10-18',category_id:id(5),expense_id:null,party_name:'はる',memo:'',revision:2};
const options={categories:[{id:id(5),name:'チケット',revision:1}],context,contexts:[context],sources:[],members:[{id:id(7),name:'はる'}]};
const dashboard={totals:{paid:400,received:0,receive_remaining:0,pay_remaining:600,forecast:1000},rows:[{id:id(6),entry_id:id(4),kind:'pay',title:'チケット',amount:400,occurred_on:'2026-10-18',paid_on:'2026-11-01',category_name:'チケット',context_title:'旅',group_name:'友達',party_name:'はる',settled:400,remaining:0,automatic:true}],breakdown:[{category_id:id(5),category_name:'チケット',forecast:1000}],total_count:1};
const detail={entry,settled:400,remaining:600,payments:[{id:id(6),entry_id:entry.id,amount:400,paid_on:'2026-11-01',memo:'先に一部',revision:1}],payment_count:1,receivables:[]};
const render=async page=>{const inner=page.props.children;return renderToStaticMarkup(await inner.type(inner.props));};
beforeEach(()=>backend.configure({options,dashboard,detail}));

test('private overview leads with forecast and shows three kinds, occurrence-month filters and automatic expenses',async()=>{
 const html=await render(Dashboard({searchParams:Promise.resolve({context:id(1),month:'2026-10'})}));
 assert.match(html,/自分の負担見込み/);assert.match(html,/あなただけ/);assert.match(html,/出費/);assert.match(html,/もらう/);assert.match(html,/あとでわたす/);assert.match(html,/支払履歴から自動表示/);assert.match(html,/費用が発生した月/);assert.match(html,/実際の支払日 2026-11-01/);
 assert.ok(html.indexOf('自分の負担見込み')<html.indexOf('支払った合計'));assert.ok(html.includes('/app/finance/entries/'+id(4)));
});
test('signed-out requests stop before personal data reads and failures show safe errors',async()=>{
 backend.configure({signedOut:true});await assert.rejects(render(Dashboard({searchParams:Promise.resolve({})})),e=>e.location==='/auth/login');assert.deepEqual(backend.calls,['auth']);
 backend.configure({options,dashboard,fail:true});const html=await render(Dashboard({searchParams:Promise.resolve({})}));assert.match(html,/安全なエラー/);assert.ok(!html.includes('チケット'));
});
test('entry forms keep private target, integer yen, dates, member/free names and optional memo',()=>{
 const html=renderToStaticMarkup(createElement(FinanceEntryForm,{options,requestId:id(8),kind:'receive'}));
 assert.match(html,/name="contextId"/);assert.ok(html.includes(id(1)));assert.match(html,/inputMode="numeric"/);assert.match(html,/名前を自分で入力/);assert.match(html,/はる/);assert.match(html,/相手の名前/);assert.match(html,/費用が発生した日/);assert.match(html,/メモ/);assert.ok(!html.includes('name="ownerId"'));
});
test('new records require a target, and archived context details retain records without shared-resource links',async()=>{
 const picker=await render(New({searchParams:Promise.resolve({kind:'expense'})}));assert.match(picker,/どのおでかけに残そう/);
 backend.configure({options:{...options,context:{...context,accessible:false},members:[]},dashboard,detail});
 const html=await render(Detail({params:Promise.resolve({entryId:entry.id}),searchParams:Promise.resolve({})}));assert.match(html,/先に一部/);assert.match(html,/残り/);assert.match(html,/支払った分は出費にも自動表示/);assert.match(html,/この履歴を取り消す/);assert.ok(!html.includes('/app/groups/'+context.group_id+'/outings/'));
});
test('expense deletion explicitly includes linked receipts and their history',()=>{
 const html=renderToStaticMarkup(createElement(FinanceDeleteEntry,{entry:{...entry,kind:'expense'},receivableCount:2,paymentCount:0}));assert.match(html,/紐づく「もらう」2件/);assert.match(html,/受取履歴もすべて削除/);assert.match(html,/type="checkbox"/);assert.match(html,/required=""/);
});
