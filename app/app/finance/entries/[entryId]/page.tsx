import {randomUUID} from 'node:crypto';
import {Suspense} from 'react';
import Link from 'next/link';
import {financeSession} from '@/lib/finance/session';
import {financeOptions,financeDetail} from '@/lib/finance/repository';
import {financeId,FINANCE_KINDS,financeHref,formatYen} from '@/lib/finance/validation';
import {japanCalendarToday} from '@/lib/outings/calendar';
import {FinancePrivacy,FinanceFailure,FinanceContextLabel,financeNewHref} from '@/components/finance/shared';
import {FinanceEntryForm,FinancePaymentForm,FinanceDeletePayment,FinanceDeleteEntry} from '@/components/finance/forms';
type Props={params:Promise<{entryId:string}>;searchParams:Promise<{historyPage?:string}>};
async function Content({params,searchParams}:Props){
 const {entryId}=await params,search=await searchParams,client=await financeSession('/app/finance');
 try{
  const id=financeId(entryId),page=search.historyPage&&/^[1-9][0-9]{0,4}$/.test(search.historyPage)?Number(search.historyPage):1,detail=await financeDetail(client,id,page),{entry}=detail;
  const [options,parent]=await Promise.all([financeOptions(client,entry.context_id),entry.expense_id?financeDetail(client,entry.expense_id):Promise.resolve(null)]),ctx=options.context!,today=japanCalendarToday(new Date());
  return <><Link href={financeHref({context:ctx.id,month:null,kind:entry.kind})} className="kk-text-link self-start">← {FINANCE_KINDS[entry.kind]}の一覧へ</Link><header className="kk-page-heading"><p className="kk-eyebrow">{FINANCE_KINDS[entry.kind]} · {options.categories.find(c=>c.id===entry.category_id)?.name}</p><h1>{entry.title}</h1><FinancePrivacy/></header>
   <section className="kk-surface space-y-4"><p className="kk-finance-detail-amount">{formatYen(entry.amount)}</p><p className="kk-muted">{entry.kind==='expense'?'支払った金額':'予定額'} · 費用が発生した日 {entry.occurred_on}</p>{entry.party_name&&<p className="font-semibold">{entry.party_name}{entry.kind==='receive'?'からもらう':'へわたす'}</p>}
    {entry.kind!=='expense'&&<><div className="kk-row"><p className="text-sm">{entry.kind==='receive'?'受取済み':'支払済み'} {formatYen(detail.settled)}</p><strong>残り {formatYen(detail.remaining)}</strong></div><div role="progressbar" aria-label={entry.kind==='receive'?'受け取りの進み具合':'支払いの進み具合'} aria-valuemin={0} aria-valuemax={entry.amount} aria-valuenow={detail.settled} className="kk-finance-progress"><span style={{width:(detail.settled/entry.amount*100)+'%'}}/></div>{detail.remaining===0&&<p className="text-sm font-semibold">精算済みです</p>}</>}
    {entry.memo&&<p className="whitespace-pre-wrap break-words text-sm leading-7">{entry.memo}</p>}{parent&&<Link href={'/app/finance/entries/'+parent.entry.id} className="kk-text-link">元の出費：{parent.entry.title} →</Link>}
    <details className="kk-inline-editor"><summary className="kk-edit-button cursor-pointer">名前・金額・日付・分類を編集</summary><FinanceEntryForm entry={entry} parent={parent?.entry} options={options} requestId={entry.id} kind={entry.kind}/></details>
   </section>
   <FinanceContextLabel context={ctx}/>{ctx.accessible&&<Link href={'/app/groups/'+ctx.group_id+'/'+(ctx.kind==='outing'?'outings/':'visits/')+ctx.source_id} className="kk-text-link self-start">元の{ctx.kind==='outing'?'おでかけ':'訪問記録'}へ →</Link>}
   {entry.kind==='expense'&&<section className="kk-surface space-y-4"><h2 className="text-xl font-bold">この出費から、もらう分</h2>{detail.receivables.length>0&&<ul className="kk-finance-source-list">{detail.receivables.map(r=><li key={r.id}><Link href={'/app/finance/entries/'+r.id}><span><strong>{r.party_name} · {r.title}</strong><small>予定額 {formatYen(r.amount)}</small></span><span aria-hidden="true">→</span></Link></li>)}</ul>}<Link href={financeNewHref('receive',ctx.id,entry.id)} className="kk-primary-link">＋ もらう分を追加</Link></section>}
   {entry.kind!=='expense'&&<><section className="kk-surface space-y-4"><h2 className="text-xl font-bold">{entry.kind==='receive'?'受け取りを記録':'支払いを記録'}</h2><p className="kk-muted">一部だけでも記録できます。{entry.kind==='pay'?'支払った分は出費にも自動表示し、合計では一度だけ数えます。':''}</p>{detail.remaining>0?<FinancePaymentForm entry={entry} requestId={randomUUID()} today={today}/>:<p className="font-semibold">全額の受け渡しを記録しています。</p>}</section>
    <section className="space-y-4"><h2 className="text-xl font-bold">受け渡しの履歴（{detail.payment_count}件）</h2>{detail.payments.length?<ul className="kk-finance-history">{detail.payments.map(p=><li key={p.id}><div className="kk-row"><strong>{formatYen(p.amount)}</strong><time className="text-sm" dateTime={p.paid_on}>{p.paid_on}</time></div>{p.memo&&<p className="mt-3 break-words text-sm">{p.memo}</p>}<details className="kk-inline-editor"><summary className="kk-edit-button cursor-pointer">この履歴を編集</summary><FinancePaymentForm entry={entry} payment={p} requestId={p.id} today={today}/></details><details className="kk-inline-editor"><summary className="kk-edit-button cursor-pointer">この履歴を取り消す</summary><FinanceDeletePayment entry={entry} payment={p}/></details></li>)}</ul>:<p className="kk-muted">受け渡しの履歴はまだありません。</p>}{(page>1||page*20<detail.payment_count)&&<nav className="kk-pager" aria-label="受け渡し履歴のページ">{page>1?<Link href={'/app/finance/entries/'+entry.id+'?historyPage='+(page-1)} className="kk-text-link">← 前の履歴</Link>:<span/>}<span>{page}ページ</span>{page*20<detail.payment_count&&<Link href={'/app/finance/entries/'+entry.id+'?historyPage='+(page+1)} className="kk-text-link">次の履歴 →</Link>}</nav>}</section></>}
   <details className="kk-surface"><summary className="kk-edit-button cursor-pointer">… この明細を削除</summary><FinanceDeleteEntry entry={entry} receivableCount={detail.receivables.length} paymentCount={detail.payment_count}/></details>
  </>;
 }catch(error){return <FinanceFailure error={error}/>;}
}
export default function FinanceEntryPage(props:Props){return <Suspense fallback={<p role="status" className="kk-loading">自分の明細を読み込んでいます…</p>}><Content {...props}/></Suspense>;}
