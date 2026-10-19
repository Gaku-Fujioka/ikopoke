import {Suspense} from 'react';
import {redirect} from 'next/navigation';
import {financeSession} from '@/lib/finance/session';
import {FinanceError} from '@/lib/finance/repository';
import {financeId,financeKind,financeHref} from '@/lib/finance/validation';
import {FinanceFailure,financeNewHref} from '@/components/finance/shared';
type Search={source?:string;next?:string;kind?:string};
async function Content({searchParams}:{searchParams:Promise<Search>}){
 const search=await searchParams,client=await financeSession('/app/finance');let destination:string;
 try{
  const parts=search.source?.split(':');if(!parts||parts.length!==2||!['outing','visit'].includes(parts[0]))throw new FinanceError('42501');
  const source=financeId(parts[1]),kind=financeKind(search.kind??'expense'),{data,error}=await client.rpc('open_finance_context',{p_kind:parts[0],p_source:source});
  if(error)throw new FinanceError(error.code);const context=financeId(data);destination=search.next==='new'?financeNewHref(kind,context):financeHref({context,month:null});
 }catch(error){return <FinanceFailure error={error}/>;}
 redirect(destination);
}
export default function OpenFinancePage(props:{searchParams:Promise<Search>}){return <Suspense fallback={<p role="status" className="kk-loading">おでかけの会計を準備しています…</p>}><Content {...props}/></Suspense>;}
