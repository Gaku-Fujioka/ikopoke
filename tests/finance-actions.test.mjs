import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {registerHooks} from 'node:module';
const url=s=>`data:text/javascript,${encodeURIComponent(s)}`;
const provider=url(`export const calls=[];let config={};export function configure(c={}){config=c;calls.length=0;}export async function createClient(){return {auth:{getClaims:async()=>({data:config.signedOut?null:{claims:{sub:'verified-user'}},error:null})},rpc:async(name,args)=>{calls.push({name,args});if(config.throw)throw Error('private-token');return {data:config.missing?null:1,error:config.code?{code:config.code,message:'private-token'}:null};}};}`);
const cache=url(`export const paths=[];export function revalidatePath(...args){paths.push(args);}`);
const env=url(`export let hasEnvVars=true;export function configure(v){hasEnvVars=v;}`);
const request=url(`let wait=null,release;export function pause(){wait=new Promise(done=>{release=done;});}export function finish(){release?.();wait=null;}export async function connection(){await wait;}`);
registerHooks({resolve(s,c,next){const mapped={'@/lib/supabase/server':provider,'@/lib/utils':env,'next/cache':cache,'next/server':request,'next/navigation':url(`export function redirect(location){throw Object.assign(Error('redirect'),{location});}`)}[s];if(mapped)return {url:mapped,shortCircuit:true};if(s.startsWith('@/'))return {url:new URL('../'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const backend=await import(provider),invalidations=await import(cache),environment=await import(env),requestBoundary=await import(request),actions=await import('../app/app/finance/actions.ts'),{financeSession}=await import('../lib/finance/session.ts');
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function form(values={}){const f=new FormData();for(const[k,v]of Object.entries({id:id(1),revision:'0',contextId:id(2),kind:'expense',title:' ランチ ',amount:'１，０００',date:'2026-10-18',categoryId:id(3),memo:'',entryId:id(4),paymentRevision:'0',operation:'save',paidOn:'2026-10-19',...values}))if(v!==null)f.set(k,v);return f;}
const state={error:null};
beforeEach(()=>{backend.configure();invalidations.paths.length=0;environment.configure(true);});

test('personal pages defer environment and authentication until a request, including missing-settings builds',async()=>{
 environment.configure(false);requestBoundary.pause();let finished=false;
 const pending=financeSession().catch(error=>{finished=true;throw error;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);
 requestBoundary.finish();await assert.rejects(pending,error=>/準備中/.test(error.message));assert.deepEqual(backend.calls,[]);
 environment.configure(true);assert.ok((await financeSession()).rpc);
 backend.configure({signedOut:true});await assert.rejects(financeSession('/app/finance/categories'),error=>error.location==='/auth/login?next=%2Fapp%2Ffinance%2Fcategories');
});

test('invalid amounts/dates/context/party and signed-out requests never mutate or invalidate',async()=>{
 for(const values of [{amount:'0'},{amount:'-1'},{amount:'1.5'},{amount:'1,2'},{amount:'1000000001'},{date:'2026-02-30'},{contextId:'https://evil.invalid'},{kind:'receive',partyName:''}])assert.ok((await actions.saveFinanceEntryAction(state,form(values))).error);
 assert.deepEqual(backend.calls,[]);backend.configure({signedOut:true});assert.ok((await actions.saveFinanceEntryAction(state,form())).error);assert.deepEqual(backend.calls,[]);assert.deepEqual(invalidations.paths,[]);
 environment.configure(false);assert.match((await actions.saveFinanceCategoryAction(state,form({name:'食事'}))).error,/準備中/);assert.deepEqual(backend.calls,[]);
});
test('entry creation uses no caller identity, normalizes money, preserves UUID and redirects only after verified success',async()=>{
 await assert.rejects(actions.saveFinanceEntryAction(state,form({ownerId:'forged',groupId:'forged',next:'https://evil.invalid'})),e=>e.location==='/app/finance/entries/'+id(1));
 assert.equal(backend.calls[0].name,'save_finance_entry');assert.deepEqual(backend.calls[0].args,{p_id:id(1),p_expected:0,p_data:{kind:'expense',context_id:id(2),title:'ランチ',amount:1000,occurred_on:'2026-10-18',category_id:id(3),expense_id:null,expense_revision:null,party_name:'',member_id:null,memo:''}});
 assert.deepEqual(invalidations.paths,[['/app/finance','layout']]);
});
test('stale, missing, invalid and network write responses never claim success, navigate or expose provider text',async()=>{
 for(const config of [{code:'40001'},{code:'22023'},{code:'42501'},{code:'55000'},{throw:true},{missing:true}]){
  backend.configure(config);const result=await actions.saveFinanceEntryAction(state,form());assert.ok(result.error);assert.ok(!result.error.includes('private'));assert.equal(result.success,undefined);assert.deepEqual(invalidations.paths,[]);
 }
});
test('partial settlement editing/deletion uses entry and payment versions; deletion requires explicit confirmation',async()=>{
 let result=await actions.saveFinancePaymentAction(state,form({revision:'2',paymentRevision:'1',ownerId:'forged'}));assert.equal(result.error,null);assert.equal(backend.calls[0].args.p_expected,2);assert.equal(backend.calls[0].args.p_payment_revision,1);assert.deepEqual(backend.calls[0].args.p_data,{amount:1000,paid_on:'2026-10-19',memo:''});
 backend.configure();invalidations.paths.length=0;assert.ok((await actions.saveFinancePaymentAction(state,form({revision:'2',paymentRevision:'1',operation:'delete'}))).error);assert.equal(backend.calls.length,0);
 result=await actions.saveFinancePaymentAction(state,form({revision:'2',paymentRevision:'1',operation:'delete',confirm:'delete'}));assert.equal(result.error,null);assert.equal(backend.calls[0].args.p_delete,true);assert.deepEqual(backend.calls[0].args.p_data,{});
 backend.configure();assert.ok((await actions.saveFinancePaymentAction(state,form({revision:'1',operation:'unknown'}))).error);assert.deepEqual(backend.calls,[]);
});
test('entry cascades require confirmation and category changes stay personal',async()=>{
 assert.ok((await actions.deleteFinanceEntryAction(state,form({revision:'2'}))).error);assert.deepEqual(backend.calls,[]);
 await assert.rejects(actions.deleteFinanceEntryAction(state,form({revision:'2',confirm:'delete',next:'https://evil.invalid'})),e=>e.location.startsWith('/app/finance?context=')&&!e.location.includes('evil'));
 assert.deepEqual(backend.calls[0],{name:'delete_finance_entry',args:{p_id:id(1),p_expected:2,p_confirm:true}});
 backend.configure();const result=await actions.saveFinanceCategoryAction(state,form({name:' 趣味 ',ownerId:'forged'}));assert.equal(result.error,null);assert.deepEqual(backend.calls[0],{name:'save_finance_category',args:{p_id:id(1),p_name:'趣味',p_expected:0}});
});
