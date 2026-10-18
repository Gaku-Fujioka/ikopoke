import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/supabase/database.types';
import {isGroupId} from '@/lib/groups/validation';
import type {FinanceContext,FinanceDetail,FinanceOptions,FinanceDashboard,FinanceEntry} from '@/lib/finance/types';

export class FinanceError extends Error{
 constructor(code?:string){super(code==='40001'?'別の画面で変更されています。入力内容を控え、再読み込みしてからお試しください。':code==='23505'?'同じ名前の分類があるか、保存内容が変わっています。内容を確認して再読み込みしてください。':['22023','22003','22008','22P02','23514'].includes(code??'')?'金額・日付をご確認ください。予定額は精算済み額以上にし、受け渡しは残額以内で記録してください。':['42P01','PGRST202','PGRST205'].includes(code??'')?'会計機能は準備中です。利用できるようになるまでお待ちください。':code==='54000'?'分類は50件まで登録できます。既存の分類をご利用ください。':['42501','28000','55000'].includes(code??'')?'この会計を開けませんでした。プロフィールから開き直して、ログイン状態をご確認ください。':'会計を読み書きできませんでした。通信状態をご確認のうえ、もう一度お試しください。');}
}
const integer=(v:unknown,min=0)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const text=(v:unknown)=>typeof v==='string';
const date=(v:unknown)=>typeof v==='string'&&/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const assert=(ok:unknown)=>{if(!ok)throw new FinanceError();};
function context(c:FinanceContext):FinanceContext{
 assert(c&&isGroupId(c.id)&&isGroupId(c.source_id)&&isGroupId(c.group_id)&&(c.kind==='outing'||c.kind==='visit')&&text(c.title)&&text(c.group_name)&&date(c.occurred_on)&&(c.outing_id===null||isGroupId(c.outing_id))&&(c.outing_title===null||text(c.outing_title)));
 return {id:c.id,kind:c.kind,source_id:c.source_id,group_id:c.group_id,outing_id:c.outing_id,group_name:c.group_name,title:c.title,outing_title:c.outing_title,occurred_on:c.occurred_on,created_at:c.created_at};
}
function entry(e:FinanceEntry):FinanceEntry{
 assert(e&&isGroupId(e.id)&&isGroupId(e.context_id)&&['expense','receive','pay'].includes(e.kind)&&text(e.title)&&integer(e.amount,1)&&e.amount<=1000000000&&date(e.occurred_on)&&isGroupId(e.category_id)&&(e.expense_id===null||isGroupId(e.expense_id))&&text(e.party_name)&&text(e.memo)&&integer(e.revision,1));
 return {id:e.id,context_id:e.context_id,kind:e.kind,title:e.title,amount:e.amount,occurred_on:e.occurred_on,category_id:e.category_id,expense_id:e.expense_id,party_name:e.party_name,memo:e.memo,revision:e.revision,created_at:e.created_at,updated_at:e.updated_at};
}
export async function financeOptions(client:SupabaseClient<Database>,id:string|null=null):Promise<FinanceOptions>{
 const {data,error}=await client.rpc('get_finance_options',{p_context:id});if(error||!data)throw new FinanceError(error?.code);
 assert(Array.isArray(data.categories)&&data.categories.length>0&&data.categories.length<=50&&Array.isArray(data.contexts)&&Array.isArray(data.sources)&&Array.isArray(data.members)&&data.contexts.length<=500&&data.sources.length<=40);
 const categories=data.categories.map(c=>{assert(c&&isGroupId(c.id)&&text(c.name)&&integer(c.revision,1));return {id:c.id,name:c.name,revision:c.revision,created_at:c.created_at};});
 const contexts=data.contexts.map(context),ctx=data.context?{...context(data.context),accessible:data.context.accessible}:null;
 assert(id?(ctx?.id===id&&typeof ctx.accessible==='boolean'):ctx===null);
 const sources=data.sources.map(s=>{assert(s&&isGroupId(s.id)&&['outing','visit'].includes(s.kind)&&text(s.title)&&text(s.group_name)&&date(s.occurred_on));return {id:s.id,kind:s.kind,title:s.title,group_name:s.group_name,occurred_on:s.occurred_on};});
 const members=data.members.map(m=>{assert(m&&isGroupId(m.id)&&text(m.name));return {id:m.id,name:m.name};});
 return {categories,contexts,context:ctx,members,sources};
}
export async function financeDashboard(client:SupabaseClient<Database>,query:{context:string|null;month:string|null;kind:string;page:number}):Promise<FinanceDashboard>{
 const {data,error}=await client.rpc('get_finance_dashboard',{p_context:query.context,p_month:query.month,p_kind:query.kind,p_page:query.page});if(error||!data)throw new FinanceError(error?.code);
 const t=data.totals;assert(t&&integer(t.paid)&&integer(t.received)&&integer(t.receive_remaining)&&integer(t.pay_remaining)&&integer(t.forecast,-Number.MAX_SAFE_INTEGER));
 assert(t.forecast===t.paid-t.received-t.receive_remaining+t.pay_remaining&&Array.isArray(data.rows)&&data.rows.length<=30&&integer(data.total_count)&&Array.isArray(data.breakdown));
 const rows=data.rows.map(r=>{assert(r&&isGroupId(r.id)&&isGroupId(r.entry_id)&&['expense','receive','pay'].includes(r.kind)&&text(r.title)&&integer(r.amount,1)&&date(r.occurred_on)&&(r.paid_on===null||date(r.paid_on))&&text(r.category_name)&&text(r.context_title)&&text(r.group_name)&&text(r.party_name)&&integer(r.settled)&&integer(r.remaining)&&typeof r.automatic==='boolean');return {id:r.id,entry_id:r.entry_id,kind:r.kind,title:r.title,amount:r.amount,occurred_on:r.occurred_on,paid_on:r.paid_on,category_name:r.category_name,context_title:r.context_title,group_name:r.group_name,party_name:r.party_name,settled:r.settled,remaining:r.remaining,automatic:r.automatic};});
 const breakdown=data.breakdown.map(b=>{assert(b&&isGroupId(b.category_id)&&text(b.category_name)&&integer(b.forecast,-Number.MAX_SAFE_INTEGER));return {category_id:b.category_id,category_name:b.category_name,forecast:b.forecast};});
 assert(breakdown.reduce((sum,b)=>sum+b.forecast,0)===t.forecast);
 return {totals:{paid:t.paid,received:t.received,receive_remaining:t.receive_remaining,pay_remaining:t.pay_remaining,forecast:t.forecast},breakdown,rows,total_count:data.total_count};
}
export async function financeDetail(client:SupabaseClient<Database>,id:string,page=1):Promise<FinanceDetail>{
 const {data,error}=await client.rpc('get_finance_entry',{p_id:id,p_page:page});if(error||!data)throw new FinanceError(error?.code);
 const e=entry(data.entry);assert(e.id===id&&integer(data.settled)&&integer(data.remaining)&&Array.isArray(data.payments)&&data.payments.length<=20&&integer(data.payment_count)&&Array.isArray(data.receivables));
 assert(e.kind==='expense'?data.settled===0&&data.remaining===0:data.settled+data.remaining===e.amount);
 const payments=data.payments.map(p=>{assert(p&&isGroupId(p.id)&&p.entry_id===e.id&&integer(p.amount,1)&&date(p.paid_on)&&text(p.memo)&&integer(p.revision,1));return {id:p.id,entry_id:p.entry_id,amount:p.amount,paid_on:p.paid_on,memo:p.memo,revision:p.revision,created_at:p.created_at};});
 const receivables=data.receivables.map(r=>{assert(r&&isGroupId(r.id)&&text(r.title)&&integer(r.amount,1)&&text(r.party_name));return {id:r.id,title:r.title,amount:r.amount,party_name:r.party_name};});
 return {entry:e,settled:data.settled,remaining:data.remaining,payments,payment_count:data.payment_count,receivables};
}
