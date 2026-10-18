"use client";
import {useActionState,useState} from 'react';
import Link from 'next/link';
import {saveFinanceEntryAction,saveFinancePaymentAction,deleteFinanceEntryAction,saveFinanceCategoryAction,type FinanceState} from '@/app/app/finance/actions';
import type {FinanceEntry,FinanceOptions,FinancePayment,FinanceCategory,FinanceKind} from '@/lib/finance/types';
import {FINANCE_KINDS,formatYen} from '@/lib/finance/validation';

const initial:FinanceState={error:null};
function Feedback({state}:{state:FinanceState}){return <>{state.error&&<p role="alert" className="text-sm leading-7 text-red-700">{state.error}</p>}{state.success&&<p role="status" className="text-sm leading-7">{state.success}</p>}</>;}
type EntryDraft={title:string;amount:string;date:string;category:string;party:string;member:string;memo:string;revision:number;parentRevision:number|null};
export function FinanceEntryForm({options,requestId,kind,entry,parent}:{options:FinanceOptions;requestId:string;kind:FinanceKind;entry?:FinanceEntry;parent?:FinanceEntry|null}){
 const [id]=useState(entry?.id??requestId),[draft,setDraft]=useState<EntryDraft|null>(null);
 const defaults:EntryDraft={title:entry?.title??(parent?parent.title+'のもらう分':''),amount:entry?String(entry.amount):'',date:entry?.occurred_on??parent?.occurred_on??options.context!.occurred_on,category:entry?.category_id??parent?.category_id??options.categories[0]?.id??'',party:entry?.party_name??'',member:'',memo:entry?.memo??'',revision:entry?.revision??0,parentRevision:parent?.revision??null};
 const value=draft??defaults;
 function change(key:keyof EntryDraft,text:string){setDraft(current=>({...current??defaults,[key]:text}));}
 const [state,action,pending]=useActionState(async(previous:FinanceState,form:FormData)=>{const result=await saveFinanceEntryAction(previous,form);if(result.success)setDraft(null);return result;},initial);
 return <form action={action} className="kk-finance-form" aria-busy={pending}>
  <input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={value.revision}/><input type="hidden" name="contextId" value={options.context!.id}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="expenseId" value={parent?.id??''}/><input type="hidden" name="expenseRevision" value={value.parentRevision??''}/><input type="hidden" name="memberId" value={value.member}/>
  {parent&&<p className="kk-notice text-sm">「{parent.title}」に紐づけます。発生日と分類は元の出費に合わせます。</p>}
  <label>明細の名前 <input name="title" required maxLength={100} value={value.title} onChange={event=>change('title',event.target.value)} disabled={pending} className="kk-field" placeholder={kind==='expense'?'例：ランチ':kind==='receive'?'例：ランチの立て替え分':'例：チケット代'}/></label>
  <label>{kind==='expense'?'支払った金額':'予定額'} <span className="flex items-center gap-2"><input name="amount" required inputMode="numeric" maxLength={14} value={value.amount} onChange={event=>change('amount',event.target.value)} disabled={pending} className="kk-field kk-finance-money" placeholder="0"/><span>円</span></span><small>1円〜10億円の整数。カンマ付きでも入力できます。</small></label>
  {kind!=='expense'&&<><label>相手<select value={value.member} onChange={event=>change('member',event.target.value)} disabled={pending} className="kk-field"><option value="">名前を自分で入力</option>{options.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{!value.member&&<label>相手の名前<input name="partyName" required maxLength={80} value={value.party} onChange={event=>change('party',event.target.value)} disabled={pending} className="kk-field" placeholder="例：はる"/></label>}</>}
  <div className="kk-finance-form-row"><label>費用が発生した日<input type="date" name="date" required min="1900-01-01" max="2199-12-31" value={value.date} readOnly={!!parent} onChange={event=>change('date',event.target.value)} disabled={pending} className="kk-field"/></label>
   <label>分類<select name={parent?undefined:'categoryId'} required value={value.category} onChange={event=>change('category',event.target.value)} disabled={pending||!!parent} className="kk-field">{options.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{parent&&<input type="hidden" name="categoryId" value={value.category}/>}</label></div>
  <p className="kk-muted">月別集計はこの発生日でまとめます。<Link href="/app/finance/categories" className="kk-text-link">分類の追加・名前変更 →</Link></p>
  <label>メモ <span className="font-normal text-stone-500">任意</span><textarea name="memo" maxLength={1000} rows={3} value={value.memo} onChange={event=>change('memo',event.target.value)} disabled={pending} className="kk-field"/></label>
  <Feedback state={state}/><button type="submit" disabled={pending} className="kk-primary-link justify-self-start">{pending?'保存中…':entry?'変更を保存':FINANCE_KINDS[kind]+'を記録'}</button>
 </form>;
}

type HistoryDraft={amount:string;date:string;memo:string;entryRevision:number;paymentRevision:number};
export function FinancePaymentForm({entry,payment,requestId,today}:{entry:FinanceEntry;payment?:FinancePayment;requestId:string;today:string}){
 const [id,setId]=useState(payment?.id??requestId),[draft,setDraft]=useState<HistoryDraft|null>(null);
 const defaults:HistoryDraft={amount:payment?String(payment.amount):'',date:payment?.paid_on??today,memo:payment?.memo??'',entryRevision:entry.revision,paymentRevision:payment?.revision??0};
 const value=draft??defaults;
 function change(key:keyof HistoryDraft,text:string){setDraft(current=>({...current??defaults,[key]:text}));}
 const [state,action,pending]=useActionState(async(previous:FinanceState,form:FormData)=>{const result=await saveFinancePaymentAction(previous,form);if(result.success){setDraft(null);if(!payment)setId(crypto.randomUUID());}return result;},initial);
 return <form action={action} className="kk-finance-form" aria-busy={pending}>
  <input type="hidden" name="entryId" value={entry.id}/><input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={value.entryRevision}/><input type="hidden" name="paymentRevision" value={value.paymentRevision}/><input type="hidden" name="operation" value="save"/>
  <label>{entry.kind==='receive'?'受け取った金額':'支払った金額'}<span className="flex items-center gap-2"><input name="amount" required inputMode="numeric" maxLength={14} value={value.amount} onChange={event=>change('amount',event.target.value)} disabled={pending} className="kk-field"/><span>円</span></span></label>
  <label>{entry.kind==='receive'?'受け取った日':'支払った日'}<input type="date" name="paidOn" min="1900-01-01" max="2199-12-31" required value={value.date} onChange={event=>change('date',event.target.value)} disabled={pending} className="kk-field"/></label>
  <label>履歴のメモ <span className="font-normal text-stone-500">任意</span><input name="memo" maxLength={200} value={value.memo} onChange={event=>change('memo',event.target.value)} disabled={pending} className="kk-field"/></label>
  <Feedback state={state}/><button disabled={pending} className="kk-primary-link justify-self-start">{pending?'保存中…':payment?'履歴を変更':entry.kind==='receive'?'受け取りを記録':'支払いを記録'}</button>
 </form>;
}
export function FinanceDeletePayment({entry,payment}:{entry:FinanceEntry;payment:FinancePayment}){
 const [checked,setChecked]=useState<{entry:number;payment:number}|null>(null);
 const [state,action,pending]=useActionState(async(previous:FinanceState,form:FormData)=>{const result=await saveFinancePaymentAction(previous,form);if(result.success)setChecked(null);return result;},initial);
 return <form action={action} className="kk-finance-form" aria-busy={pending}><input type="hidden" name="entryId" value={entry.id}/><input type="hidden" name="id" value={payment.id}/><input type="hidden" name="revision" value={checked?.entry??entry.revision}/><input type="hidden" name="paymentRevision" value={checked?.payment??payment.revision}/><input type="hidden" name="operation" value="delete"/>
  <label className="kk-finance-confirm"><input type="checkbox" name="confirm" value="delete" required checked={!!checked} disabled={pending} onChange={event=>setChecked(event.target.checked?{entry:entry.revision,payment:payment.revision}:null)}/>この{formatYen(payment.amount)}の履歴を取り消し、残額へ戻します。{entry.kind==='pay'?'出費の自動表示も取り消されます。':''}</label><Feedback state={state}/><button disabled={pending} className="kk-text-link justify-self-start">{pending?'処理中…':'この履歴を取り消す'}</button></form>;
}
export function FinanceDeleteEntry({entry,receivableCount,paymentCount}:{entry:FinanceEntry;receivableCount:number;paymentCount:number}){
 const [expected,setExpected]=useState<number|null>(null),[state,action,pending]=useActionState(deleteFinanceEntryAction,initial);
 return <form action={action} className="kk-finance-form" aria-busy={pending}><input type="hidden" name="id" value={entry.id}/><input type="hidden" name="revision" value={expected??entry.revision}/><input type="hidden" name="contextId" value={entry.context_id}/>
  <p className="text-sm leading-7">「{entry.title}」を削除します。{entry.kind==='expense'&&receivableCount>0?`紐づく「もらう」${receivableCount}件と、その受取履歴もすべて削除します。`:paymentCount>0?`受け渡しの履歴${paymentCount}件も削除します。`:''}{entry.kind==='pay'?'支払履歴から自動表示している出費も削除します。':''}</p>
  <label className="kk-finance-confirm"><input type="checkbox" name="confirm" value="delete" required checked={expected!==null} disabled={pending} onChange={event=>setExpected(event.target.checked?entry.revision:null)}/>上の内容を確認し、明細と対象の履歴を削除します。</label><Feedback state={state}/><button disabled={pending} className="kk-text-link justify-self-start">{pending?'削除中…':'この明細を削除'}</button></form>;
}
export function FinanceCategoryForm({category,requestId}:{category?:FinanceCategory;requestId:string}){
 const [id,setId]=useState(category?.id??requestId),[draft,setDraft]=useState<{name:string;revision:number}|null>(null);
 const [state,action,pending]=useActionState(async(previous:FinanceState,form:FormData)=>{const result=await saveFinanceCategoryAction(previous,form);if(result.success){setDraft(null);if(!category)setId(crypto.randomUUID());}return result;},initial);
 return <form action={action} className="kk-finance-form" aria-busy={pending}><input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={draft?.revision??category?.revision??0}/><label>{category?'分類名を変更':'新しい分類'}<input name="name" required maxLength={40} value={draft?.name??category?.name??''} onChange={event=>setDraft(current=>({name:event.target.value,revision:current?.revision??category?.revision??0}))} disabled={pending} className="kk-field" placeholder="例：アクティビティ"/></label><Feedback state={state}/><button disabled={pending} className={category?'kk-text-link justify-self-start':'kk-primary-link justify-self-start'}>{pending?'保存中…':category?'名前を保存':'分類を追加'}</button></form>;
}
