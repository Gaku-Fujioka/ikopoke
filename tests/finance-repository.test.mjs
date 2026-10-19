import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))return {url:new URL('../'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const {financeOptions,financeDashboard,financeDetail}=await import('../lib/finance/repository.ts');
const {yen,financeDate,financeQuery,financeHref}=await import('../lib/finance/validation.ts');
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context={id:id(1),kind:'outing',source_id:id(2),group_id:id(3),outing_id:id(2),group_name:'友達',title:'日帰り',outing_title:'日帰り',occurred_on:'2026-10-18',created_at:'2026-10-18T00:00:00Z'};
const options={categories:[{id:id(4),name:'食事',revision:1,created_at:'2026-10-18T00:00:00Z'}],contexts:[context],context:null,members:[],sources:[]};
const entry={id:id(5),context_id:id(1),kind:'pay',title:'チケット',amount:1000,occurred_on:'2026-10-18',category_id:id(4),expense_id:null,party_name:'はる',memo:'',revision:1,created_at:'2026-10-18T00:00:00Z',updated_at:'2026-10-18T00:00:00Z'};
const dashboard={totals:{paid:400,received:0,receive_remaining:0,pay_remaining:600,forecast:1000},rows:[],breakdown:[{category_id:id(4),category_name:'食事',forecast:1000}],total_count:0};
const clone=v=>structuredClone(v),client=(data,error=null)=>({rpc:async()=>({data,error})});
test('repositories project only the UI contract and never expose owner or unexpected provider fields',async()=>{
 const raw=clone(options);raw.contexts[0].owner_id='secret-owner';raw.categories[0].email='private-email';
 const result=await financeOptions(client(raw));assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('private'));
 const e={entry:{...entry,owner_id:'private-owner'},settled:400,remaining:600,payments:[],payment_count:0,receivables:[]};assert.ok(!JSON.stringify(await financeDetail(client(e),entry.id)).includes('private'));
 assert.equal((await financeDashboard(client(dashboard),{context:null,month:null,kind:'expense',page:1})).totals.forecast,1000);
});
test('inconsistent, unsafe numeric or unavailable totals never masquerade as zero or disclose provider details',async()=>{
 for(const raw of [null,{...dashboard,totals:{...dashboard.totals,forecast:999}},{...dashboard,totals:{...dashboard.totals,paid:9007199254740992}},{...dashboard,breakdown:[]},{...dashboard,rows:[{id:'bad'}]}])await assert.rejects(financeDashboard(client(raw),{context:null,month:null,kind:'expense',page:1}));
 await assert.rejects(financeOptions(client(null,{code:'PGRST202',message:'private-token'})),e=>/準備中/.test(e.message)&&!e.message.includes('private'));
 await assert.rejects(financeOptions(client({...options,context:{...context,id:id(9),accessible:true}}),id(1)));
 await assert.rejects(financeDetail(client({entry,settled:400,remaining:100,payments:[],payment_count:0,receivables:[]}),entry.id));
});
test('yen/date filters keep integer precision, month boundaries and safe local URLs',()=>{
 assert.equal(yen('１，０００'),1000);assert.equal(yen('1,000,000,000'),1000000000);for(const value of ['0','-1','1.1','1e3','1,2','1000000001'])assert.throws(()=>yen(value));
 assert.equal(financeDate('2028-02-29'),'2028-02-29');for(const value of ['2026-02-29','2026-02-30','2200-01-01'])assert.throws(()=>financeDate(value));
 assert.equal(financeQuery({},'2026-10-18').month,'2026-10');assert.equal(financeQuery({context:id(1)},'2026-10-18').month,null);assert.equal(financeQuery({month:''},'2026-10-18').month,null);
 assert.ok(financeHref({context:id(1),month:null,kind:'pay',page:2}).startsWith('/app/finance?'));assert.throws(()=>financeQuery({context:'https://evil.invalid'},'2026-10-18'));
});
