import {isGroupId} from '@/lib/groups/validation';
import type {FinanceInput,FinanceKind} from '@/lib/finance/types';
export const FINANCE_KINDS={expense:'出費',receive:'もらう',pay:'あとでわたす'} as const;
export const MAX_YEN=1000000000;
export class FinanceInputError extends Error {}
export function financeKind(v:unknown):FinanceKind {if(v!=='expense'&&v!=='receive'&&v!=='pay')throw new FinanceInputError('記録の種類を選んでください。');return v;}
export function financeId(v:unknown):string {if(!isGroupId(v))throw new FinanceInputError('画面を開き直して、もう一度お試しください。');return v.toLowerCase();}
export function optionalId(v:unknown):string|null{return v===null||v===''?null:financeId(v);}
export function yen(v:unknown):number {
 const value=typeof v==='string'?v.normalize('NFKC').trim():'';
 if(!/^(?:[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/.test(value))throw new FinanceInputError('金額は1円以上の整数で入力してください。');
 const result=Number(value.replaceAll(',',''));if(!Number.isSafeInteger(result)||result>MAX_YEN)throw new FinanceInputError('金額は10億円以内で入力してください。');return result;
}
export function financeDate(v:unknown):string {
 if(typeof v!=='string'||!/^(19|20|21)[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw new FinanceInputError('日付は1900〜2199年の正しい日付で入力してください。');return v;
}
export function revision(v:unknown,allowZero=false):number {const text=typeof v==='string'?v:'';if(!/^[0-9]{1,9}$/.test(text)||Number(text)<(allowZero?0:1))throw new FinanceInputError('画面を開き直して、もう一度お試しください。');return Number(text);}
export function financeText(v:unknown,label:string,max:number,required=false):string {if(typeof v!=='string')throw new FinanceInputError(`${label}をご確認ください。`);const value=v.trim();if((required&&!value)||Array.from(value).length>max)throw new FinanceInputError(`${label}は${required?'1〜':''}${max}文字以内で入力してください。`);return value;}
export function parseFinanceInput(form:FormData):FinanceInput{
 const kind=financeKind(form.get('kind')),expense=optionalId(form.get('expenseId'));
 if(kind!=='receive'&&expense)throw new FinanceInputError('元の出費を指定できるのは「もらう」だけです。');
 const member=kind==='expense'?null:optionalId(form.get('memberId'));
 return {kind,context_id:financeId(form.get('contextId')),title:financeText(form.get('title'),'明細の名前',100,true),amount:yen(form.get('amount')),occurred_on:financeDate(form.get('date')),category_id:financeId(form.get('categoryId')),expense_id:expense,expense_revision:expense?revision(form.get('expenseRevision')):null,party_name:kind==='expense'?'':financeText(form.get('partyName')??'','相手の名前',80,!member),member_id:member,memo:financeText(form.get('memo')??'','メモ',1000)};
}
export type FinanceSearch={context?:string;month?:string;kind?:string;page?:string};
export function financeQuery(search:FinanceSearch,today:string){
 const context=optionalId(search.context??null),kind=financeKind(search.kind??'expense');
 const month=search.month==='all'||search.month===''?null:search.month??(context?null:today.slice(0,7));
 if(month!==null){if(!/^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$/.test(month))throw new FinanceInputError('集計する月をご確認ください。');}
 const page=search.page&&/^[1-9][0-9]{0,4}$/.test(search.page)?Number(search.page):1;return {context,kind,month,page};
}
export function financeHref(query:{context?:string|null;month?:string|null;kind?:FinanceKind;page?:number}={}){
 const p=new URLSearchParams();if(query.context)p.set('context',query.context);if(query.month!==undefined)p.set('month',query.month??'all');if(query.kind&&query.kind!=='expense')p.set('kind',query.kind);if(query.page&&query.page>1)p.set('page',String(query.page));return '/app/finance'+(p.size?'?'+p:'');
}
export function formatYen(value:number){return new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(value);}
