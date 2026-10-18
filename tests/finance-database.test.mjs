import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,ids} from './shared-life-fixture.mjs';
const {alice,bob,outsider,group,otherGroup,plan}=ids;
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=async(f,user,sql,args=[],role='authenticated')=>(await f.as(user,()=>f.db.query(sql,args),role)).rows;
const rpc=async(f,user,name,args)=>{const marks=args.map((_,i)=>'$'+(i+1)).join(',');return (await query(f,user,`select public.${name}(${marks}) value`,args))[0].value;};
async function setup(){const f=await fixture();f.context=await rpc(f,alice,'open_finance_context',['outing',plan]);f.options=await rpc(f,alice,'get_finance_options',[f.context]);f.category=f.options.categories[0].id;return f;}
function entry(f,overrides={}){return {kind:'expense',context_id:f.context,title:'ランチ',amount:4000,occurred_on:'2026-10-18',category_id:f.category,expense_id:null,expense_revision:null,party_name:'',member_id:null,memo:'',...overrides};}
const save=(f,user,eid,data,revision=0)=>rpc(f,user,'save_finance_entry',[eid,revision,data]);
const detail=(f,user,eid,page=1)=>rpc(f,user,'get_finance_entry',[eid,page]);
const dash=(f,user,kind='expense',month=null,context=null,page=1)=>rpc(f,user,'get_finance_dashboard',[context,month,kind,page]);
const settle=(f,user,eid,pid,revision,amount=1000,date='2026-11-03')=>rpc(f,user,'save_finance_payment',[eid,pid,revision,0,{amount,paid_on:date,memo:''},false]);

test('large totals and paginated entries/history stay complete; category limits still allow safe retries',async()=>{
 const f=await setup();try{
  assert.ok(f.options.members.every(member=>member.id!==alice));
  for(let n=0;n<61;n++)await save(f,alice,id(1000+n),entry(f,{amount:1000000000}));
  const pages=await Promise.all([1,2,3].map(page=>dash(f,alice,'expense',null,f.context,page)));
  assert.deepEqual(pages.map(page=>page.rows.length),[30,30,1]);
  assert.equal(new Set(pages.flatMap(page=>page.rows.map(row=>row.id))).size,61);
  assert.ok(pages.every(page=>page.total_count===61&&page.totals.paid===61000000000));
  await save(f,alice,id(2000),entry(f,{kind:'pay',amount:100,party_name:'友達'}));
  for(let n=0;n<25;n++)await settle(f,alice,id(2000),id(2100+n),n+1,1);
  const first=await detail(f,alice,id(2000),1),second=await detail(f,alice,id(2000),2);
  assert.equal(first.payment_count,25);assert.equal(first.payments.length,20);assert.equal(second.payments.length,5);
  assert.equal(new Set([...first.payments,...second.payments].map(payment=>payment.id)).size,25);
  const totals=(await dash(f,alice)).totals;assert.equal(totals.paid,61000000025);assert.equal(totals.pay_remaining,75);assert.equal(totals.forecast,61000000100);
  for(let n=0;n<43;n++)await rpc(f,alice,'save_finance_category',[id(3000+n),'分類'+n,0]);
  assert.equal(await rpc(f,alice,'save_finance_category',[id(3042),'分類42',0]),1);
  await assert.rejects(rpc(f,alice,'save_finance_category',[id(3043),'51件目',0]),error=>error.code==='54000');
 }finally{await f.db.close();}
});

test('finance is private even to co-members; direct CRUD and forged contexts/categories/parents are denied',async()=>{
 const f=await setup();try{
  await save(f,alice,id(1),entry(f));
  assert.equal((await query(f,bob,'select * from public.finance_entries')).length,0);
  await assert.rejects(query(f,null,'select * from public.finance_entries',[],'anon'),e=>e.code==='42501');
  for(const operation of ['update public.finance_entries set amount=1','delete from public.finance_entries',"insert into public.finance_categories(owner_id,name) values(auth.uid(),'侵入')"])
   await assert.rejects(query(f,alice,operation),e=>e.code==='42501');
  for(const user of [bob,outsider]){
   await assert.rejects(detail(f,user,id(1)),e=>e.code==='42501');
   await assert.rejects(dash(f,user,'expense',null,f.context),e=>e.code==='42501');
   await assert.rejects(save(f,user,id(2),entry(f)),e=>e.code==='42501');
   await assert.rejects(rpc(f,user,'delete_finance_entry',[id(1),1,true]),e=>e.code==='42501');
  }
  const bobContext=await rpc(f,bob,'open_finance_context',['outing',plan]);const bobOptions=await rpc(f,bob,'get_finance_options',[bobContext]);
  await assert.rejects(save(f,alice,id(3),entry(f,{category_id:bobOptions.categories[0].id})),e=>e.code==='42501');
  await assert.rejects(save(f,bob,id(3),entry(f,{context_id:bobContext,category_id:bobOptions.categories[0].id,kind:'receive',expense_id:id(1),expense_revision:1,party_name:'侵入'})),e=>e.code==='42501');
  await assert.rejects(rpc(f,outsider,'open_finance_context',['outing',plan]),e=>e.code==='42501');
  await assert.rejects(rpc(f,null,'get_finance_options',[null]),e=>e.code==='28000');
  assert.equal((await detail(f,alice,id(1))).entry.amount,4000);
 }finally{await f.db.close();}
});

test('partial receipts and later payments preserve forecast, show outgoing history as expenses once, and use occurrence month',async()=>{
 const f=await setup();try{
  await save(f,alice,id(1),entry(f));
  await save(f,alice,id(2),entry(f,{kind:'receive',title:'ランチをもらう',amount:2000,party_name:'はる',expense_id:id(1),expense_revision:1}));
  await save(f,alice,id(3),entry(f,{kind:'pay',title:'チケットを返す',amount:1000,party_name:'はる'}));
  const before=await dash(f,alice,'expense','2026-10',f.context);assert.equal(before.totals.forecast,3000);assert.equal(before.totals.paid,4000);
  assert.equal(before.totals.receive_remaining,2000);assert.equal(before.totals.pay_remaining,1000);
  await settle(f,alice,id(2),id(21),1,500);await settle(f,alice,id(3),id(31),1,400);
  const after=await dash(f,alice,'expense','2026-10',f.context);
  assert.deepEqual(after.totals,{paid:4400,received:500,receive_remaining:1500,pay_remaining:600,forecast:3000});
  assert.equal(after.total_count,2);assert.equal(after.rows.filter(r=>r.automatic).length,1);assert.equal(after.rows.find(r=>r.automatic).amount,400);
  assert.equal(after.rows.find(r=>r.automatic).paid_on,'2026-11-03');assert.equal(after.breakdown.reduce((sum,row)=>sum+row.forecast,0),3000);
  const november=await dash(f,alice,'expense','2026-11',f.context);assert.equal(november.totals.paid,0);assert.equal(november.total_count,0);
  await assert.rejects(settle(f,alice,id(3),id(32),2,601),e=>e.code==='22023');
  await assert.rejects(save(f,alice,id(3),entry(f,{kind:'pay',title:'チケットを返す',amount:399,party_name:'はる'}),2),e=>e.code==='22023');
 }finally{await f.db.close();}
});

test('idempotent requests, optimistic revisions and deletion prevent duplicates, overwrites and resurrection',async()=>{
 const f=await setup();try{
  const data=entry(f);assert.equal(await save(f,alice,id(1),data),1);assert.equal(await save(f,alice,id(1),data),1);
  await assert.rejects(save(f,alice,id(1),entry(f,{amount:5000})),e=>e.code==='23505');
  await save(f,alice,id(2),entry(f,{kind:'receive',party_name:'友達',amount:2000,expense_id:id(1),expense_revision:1}));
  assert.equal((await detail(f,alice,id(1))).entry.revision,2);
  await assert.rejects(rpc(f,alice,'delete_finance_entry',[id(1),1,true]),e=>e.code==='40001');
  assert.equal(await settle(f,alice,id(2),id(21),1,500),2);assert.equal(await settle(f,alice,id(2),id(21),1,500),2);
  await assert.rejects(settle(f,alice,id(2),id(22),1,100),e=>e.code==='40001');
  const parent=await detail(f,alice,id(1));await assert.rejects(rpc(f,alice,'delete_finance_entry',[id(1),parent.entry.revision,false]),e=>e.code==='22023');
  await rpc(f,alice,'delete_finance_entry',[id(1),parent.entry.revision,true]);
  assert.equal((await query(f,alice,'select * from public.finance_entries')).length,0);assert.equal((await query(f,alice,'select * from public.finance_payments')).length,0);
  await assert.rejects(save(f,alice,id(1),data),e=>e.code==='55000');
 }finally{await f.db.close();}
});

test('editing/deleting settlement history changes the same outgoing row and keeps immutable request tombstones',async()=>{
 const f=await setup();try{
  await save(f,alice,id(1),entry(f,{kind:'pay',party_name:'友達',amount:1000}));
  await settle(f,alice,id(1),id(11),1,400);
  await rpc(f,alice,'save_finance_payment',[id(1),id(11),2,1,{amount:600,paid_on:'2026-10-19',memo:'訂正'},false]);
  let d=await dash(f,alice);assert.equal(d.totals.paid,600);assert.equal(d.totals.pay_remaining,400);assert.equal(d.total_count,1);
  await rpc(f,alice,'save_finance_payment',[id(1),id(11),3,2,{},true]);d=await dash(f,alice);assert.equal(d.total_count,0);assert.equal(d.totals.forecast,1000);
  await assert.rejects(settle(f,alice,id(1),id(11),4,400),e=>e.code==='55000');
 }finally{await f.db.close();}
});

test('category changes are personal, linked receipts follow the original date/category and reject invalid money/dates/people',async()=>{
 const f=await setup();try{
  await rpc(f,alice,'save_finance_category',[id(90),'自分の分類',0]);await rpc(f,alice,'save_finance_category',[id(90),'趣味',1]);
  await assert.rejects(rpc(f,bob,'save_finance_category',[id(90),'横取り',2]),e=>e.code==='40001');
  for(const changes of [{amount:0},{amount:-1},{amount:1.5},{occurred_on:'2026-02-30'},{occurred_on:'2200-01-01'},{title:''}])await assert.rejects(save(f,alice,id(1),entry(f,changes)));
  await save(f,alice,id(1),entry(f));
  await assert.rejects(save(f,alice,id(2),entry(f,{kind:'receive',member_id:outsider})),e=>e.code==='42501');
  await save(f,alice,id(2),entry(f,{kind:'receive',member_id:bob,party_name:'無視される名前',expense_id:id(1),expense_revision:1,amount:2000}));
  assert.equal((await detail(f,alice,id(2))).entry.party_name,'はる');
  await save(f,alice,id(1),entry(f,{category_id:id(90),occurred_on:'2026-11-01'}),2);
  const receive=await detail(f,alice,id(2));assert.equal(receive.entry.category_id,id(90));assert.equal(receive.entry.occurred_on,'2026-11-01');assert.equal(receive.entry.revision,2);
  assert.equal((await dash(f,alice,'expense','2026-10')).totals.forecast,0);assert.equal((await dash(f,alice,'expense','2026-11')).totals.forecast,2000);
 }finally{await f.db.close();}
});

test('outing totals include direct-visit records; exit and last-member group deletion preserve private snapshots',async()=>{
 const f=await setup();try{
  await rpc(f,alice,'record_stop_visit',[group,ids.cafe,plan,null,'2026-10-18','',null,ids.visit,null,null]);
  const visitContext=await rpc(f,alice,'open_finance_context',['visit',ids.visit]);
  await save(f,alice,id(1),entry(f,{context_id:visitContext}));assert.equal((await dash(f,alice,'expense',null,f.context)).totals.paid,4000);
  await rpc(f,alice,'begin_leave_group',[group,2,false]);
  assert.equal((await rpc(f,alice,'get_finance_options',[visitContext])).members.length,0);assert.equal((await detail(f,alice,id(1))).entry.amount,4000);
  await save(f,alice,id(2),entry(f,{context_id:visitContext,title:'帰りの電車',amount:500}));
  const other=await rpc(f,outsider,'open_finance_context',['outing',plan]).catch(()=>null);assert.equal(other,null);
  await query(f,outsider,"select public.set_my_display_name('別の人')");
  const soloPlan=id(50);await query(f,outsider,"select public.save_outing($1,$2,0,'ひとり旅','2026-10-19','order','',$3,$4)",[otherGroup,soloPlan,JSON.stringify([{item_id:ids.other}]),[outsider]]);
  const soloContext=await rpc(f,outsider,'open_finance_context',['outing',soloPlan]);const soloOptions=await rpc(f,outsider,'get_finance_options',[soloContext]);
  await save(f,outsider,id(3),entry(f,{context_id:soloContext,category_id:soloOptions.categories[0].id}));
  await rpc(f,outsider,'begin_leave_group',[otherGroup,1,true]);await rpc(f,outsider,'finish_leave_group',[otherGroup]);
  const kept=await rpc(f,outsider,'get_finance_options',[soloContext]);assert.equal(kept.context.title,'ひとり旅');assert.equal(kept.context.accessible,false);assert.equal((await dash(f,outsider)).totals.paid,4000);
 }finally{await f.db.close();}
});

test('account removal hides stale-JWT reads and deletes all private finance rows and request records',async()=>{
 const f=await setup();try{
  await save(f,alice,id(1),entry(f));
  await query(f,null,'select public.prepare_account_deletion($1,$2,$3,$4)',[alice,id(99),[group],[]],'service_role');
  assert.equal((await query(f,alice,'select * from public.finance_entries')).length,0);
  await assert.rejects(dash(f,alice),e=>e.code==='55000');await assert.rejects(save(f,alice,id(2),entry(f)),e=>e.code==='55000');
  await query(f,null,'select public.finish_account_data($1,$2)',[alice,id(99)],'service_role');
  for(const table of ['public.finance_entries','public.finance_payments','public.finance_contexts','public.finance_categories','kokoiko_private.finance_requests'])assert.equal((await f.db.query(`select count(*)::int n from ${table} where owner_id=$1`,[alice])).rows[0].n,0);
 }finally{await f.db.close();}
});
