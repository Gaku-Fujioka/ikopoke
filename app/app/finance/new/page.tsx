import {randomUUID} from 'node:crypto';
import {Suspense} from 'react';
import Link from 'next/link';
import {financeSession} from '@/lib/finance/session';
import {financeOptions,financeDetail,FinanceError} from '@/lib/finance/repository';
import {financeKind,optionalId,FINANCE_KINDS,financeHref} from '@/lib/finance/validation';
import {FinancePrivacy,FinanceFailure,FinancePicker,FinanceContextLabel} from '@/components/finance/shared';
import {FinanceEntryForm} from '@/components/finance/forms';
type Search={kind?:string;context?:string;expense?:string};
async function Content({searchParams}:{searchParams:Promise<Search>}){
 const search=await searchParams,client=await financeSession('/app/finance');
 try{
  const kind=financeKind(search.kind??'expense'),expense=optionalId(search.expense??null),parent=expense?(await financeDetail(client,expense)).entry:null;
  if(parent&&(kind!=='receive'||parent.kind!=='expense'))throw new FinanceError('42501');
  const context=parent?.context_id??optionalId(search.context??null),options=await financeOptions(client,context);
  return <><Link href={financeHref({context,month:null,kind})} className="kk-text-link self-start">← 自分の会計へ</Link><header className="kk-page-heading"><p className="kk-eyebrow">おでかけのお金を、ひとつずつ</p><h1>{FINANCE_KINDS[kind]}を記録</h1><FinancePrivacy/></header>{context?<><FinanceContextLabel context={options.context!}/><section className="kk-surface"><FinanceEntryForm options={options} requestId={randomUUID()} kind={kind} parent={parent}/></section></>:<FinancePicker options={options} kind={kind}/>}</>;
 }catch(error){return <FinanceFailure error={error}/>;}
}
export default function NewFinancePage(props:{searchParams:Promise<Search>}){return <Suspense fallback={<p role="status" className="kk-loading">記録先を読み込んでいます…</p>}><Content {...props}/></Suspense>;}
