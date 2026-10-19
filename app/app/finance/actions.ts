"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {hasEnvVars} from '@/lib/utils';
import {FinanceError} from '@/lib/finance/repository';
import {FinanceInputError,financeId,financeText,financeDate,optionalId,parseFinanceInput,revision,yen,financeHref} from '@/lib/finance/validation';
import type {FinanceHistoryInput} from '@/lib/finance/types';

export type FinanceState={error:string|null;success?:string;revision?:number};
const failure=(error:unknown):FinanceState=>({error:error instanceof FinanceError||error instanceof FinanceInputError?error.message:new FinanceError().message});
async function clientForFinance(){if(!hasEnvVars)throw new FinanceError('PGRST202');const client=await createClient();const auth=await client.auth.getClaims();if(auth.error||!auth.data?.claims?.sub)throw new FinanceError('28000');return client;}
function refresh(){revalidatePath('/app/finance','layout');}
function resultRevision(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw new FinanceError();return value;}
export async function saveFinanceEntryAction(_previous:FinanceState,form:FormData):Promise<FinanceState>{
 let id:string,expected:number,rev:number;
 try{
  id=financeId(form.get('id'));expected=revision(form.get('revision'),true);const input=parseFinanceInput(form),client=await clientForFinance();
  const {data,error}=await client.rpc('save_finance_entry',{p_id:id,p_expected:expected,p_data:input});if(error)throw new FinanceError(error.code);rev=resultRevision(data);
 }catch(error){return failure(error);}
 refresh();if(expected===0)redirect('/app/finance/entries/'+id);return {error:null,success:'明細を保存しました。',revision:rev};
}
export async function deleteFinanceEntryAction(_previous:FinanceState,form:FormData):Promise<FinanceState>{
 let context:string|null;
 try{
  const id=financeId(form.get('id')),expected=revision(form.get('revision'));context=optionalId(form.get('contextId'));
  if(form.get('confirm')!=='delete')throw new FinanceInputError('削除する内容を確認して、チェックを入れてください。');
  const client=await clientForFinance(),{error}=await client.rpc('delete_finance_entry',{p_id:id,p_expected:expected,p_confirm:true});if(error)throw new FinanceError(error.code);
 }catch(error){return failure(error);}
 refresh();redirect(financeHref({context,month:null}));
}
export async function saveFinancePaymentAction(_previous:FinanceState,form:FormData):Promise<FinanceState>{
 try{
  const entry=financeId(form.get('entryId')),id=financeId(form.get('id')),expected=revision(form.get('revision')),paymentRevision=revision(form.get('paymentRevision'),true),deleting=form.get('operation')==='delete';
  if(form.get('operation')!=='save'&&form.get('operation')!=='delete')throw new FinanceInputError('履歴の操作をご確認ください。');
  if(deleting&&(form.get('confirm')!=='delete'||paymentRevision===0))throw new FinanceInputError('取り消す履歴を確認して、チェックを入れてください。');
  const input:FinanceHistoryInput|Record<string,never>=deleting?{}:{amount:yen(form.get('amount')),paid_on:financeDate(form.get('paidOn')),memo:financeText(form.get('memo')??'','履歴のメモ',200)};
  const client=await clientForFinance(),{data,error}=await client.rpc('save_finance_payment',{p_entry:entry,p_id:id,p_expected:expected,p_payment_revision:paymentRevision,p_data:input,p_delete:deleting});
  if(error)throw new FinanceError(error.code);const rev=resultRevision(data);refresh();return {error:null,success:deleting?'履歴を取り消しました。':'受け渡しの履歴を保存しました。',revision:rev};
 }catch(error){return failure(error);}
}
export async function saveFinanceCategoryAction(_previous:FinanceState,form:FormData):Promise<FinanceState>{
 try{
  const id=financeId(form.get('id')),expected=revision(form.get('revision'),true),name=financeText(form.get('name'),'分類名',40,true),client=await clientForFinance();
  const {data,error}=await client.rpc('save_finance_category',{p_id:id,p_name:name,p_expected:expected});if(error)throw new FinanceError(error.code);const rev=resultRevision(data);refresh();return {error:null,success:expected===0?'分類を追加しました。':'分類名を変更しました。',revision:rev};
 }catch(error){return failure(error);}
}
