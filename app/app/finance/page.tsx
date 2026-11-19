import {Suspense} from 'react';
import Link from 'next/link';
import {Plus,Settings2} from 'lucide-react';
import {financeSession} from '@/lib/finance/session';
import {financeDashboard,financeOptions} from '@/lib/finance/repository';
import {financeHref,financeQuery,formatYen,type FinanceSearch,FINANCE_KINDS} from '@/lib/finance/validation';
import {japanCalendarToday} from '@/lib/outings/calendar';
import {FinancePrivacy,FinanceFailure,FinanceSummary,FinanceTabs,FinanceContextLabel,financeNewHref} from '@/components/finance/shared';

async function Content({searchParams}:{searchParams:Promise<FinanceSearch>}){
 const search=await searchParams,client=await financeSession('/app/finance');
 let query, dashboard, options, ctx;
  try {
    query = financeQuery(search,japanCalendarToday(new Date()));
    [dashboard,options] = await Promise.all([financeDashboard(client,query),financeOptions(client,query.context)]);
    ctx = options.context;
  } catch(error){return <FinanceFailure error={error}/>;}
  return <><Link href="/app/profile" className="kk-text-link self-start">← プロフィールへ</Link><header className="kk-page-heading"><p className="kk-eyebrow">楽しかった日の、お金の記録</p><h1>自分の会計</h1><FinancePrivacy/></header>
   {ctx&&<FinanceContextLabel context={ctx}/>}
   <form action="/app/finance" className="kk-finance-filters"><input type="hidden" name="kind" value={query.kind}/><label>おでかけ・訪問<select name="context" defaultValue={query.context??''} key={query.context??'all'}><option value="">すべての記録先</option>{options.contexts.map(c=><option key={c.id} value={c.id}>{c.title} · {c.occurred_on}（{c.kind==='outing'?'おでかけ':'訪問'}）</option>)}</select></label><label>費用が発生した月<input key={query.month??'all'} type="month" name="month" min="1900-01" max="2199-12" defaultValue={query.month??''}/></label><button className="kk-secondary-link">表示</button><Link href={financeHref({...query,month:null,page:1})} className="kk-text-link">全期間</Link></form>
   <FinanceSummary totals={dashboard.totals}/>
   {dashboard.breakdown.length>0&&<details className="kk-surface"><summary className="kk-edit-button cursor-pointer">分類ごとの負担見込み</summary><dl className="kk-finance-breakdown">{dashboard.breakdown.map(b=><div key={b.category_id}><dt>{b.category_name}</dt><dd><strong>{formatYen(b.forecast)}</strong></dd></div>)}</dl><p className="kk-muted mt-3">もらう予定分も差し引いた内訳です。</p></details>}
   <FinanceTabs kind={query.kind} query={query}/>
   <div className="kk-row"><p className="kk-muted">{dashboard.total_count}件 · 発生日順</p><Link href={financeNewHref(query.kind,query.context??undefined)} className="kk-primary-link"><Plus aria-hidden="true" size={17}/>{FINANCE_KINDS[query.kind]}を追加</Link></div>
   {dashboard.rows.length?<ul className="kk-finance-list">{dashboard.rows.map(r=><li key={r.id} className="kk-finance-record"><Link href={'/app/finance/entries/'+r.entry_id}><div className="kk-finance-record-meta"><span className="kk-finance-badge">{r.category_name}</span>{r.automatic&&<span className="kk-finance-badge">支払履歴から自動表示</span>}<time dateTime={r.occurred_on}>{r.occurred_on}</time></div><div className="kk-finance-record-head"><div><h3>{r.title}</h3>{r.party_name&&<small>{r.party_name}{query.kind==='receive'?'から':query.kind==='pay'?'へ':''}</small>}</div><strong className="kk-finance-amount">{formatYen(r.amount)}</strong></div><small>{r.group_name} · {r.context_title}{r.automatic?' · 実際の支払日 '+r.paid_on:''}</small>{query.kind!=='expense'&&<p className="text-sm">残り <strong>{formatYen(r.remaining)}</strong><span className="ml-3 text-xs text-stone-500">{r.remaining===0?'精算済み':r.settled>0?'一部精算済み':'未精算'}</span></p>}</Link></li>)}</ul>:<div className="kk-empty"><h2>{query.page>1?'このページには明細がありません':'この条件の記録はまだありません'}</h2><p>食事や交通費、立て替えた分を、自分用に残してみましょう。</p></div>}
   {(query.page>1||query.page*30<dashboard.total_count)&&<nav aria-label="会計一覧のページ" className="kk-pager">{query.page>1?<Link href={financeHref({...query,page:query.page-1})} className="kk-text-link">← 前へ</Link>:<span/>}<span>{query.page}ページ</span>{query.page*30<dashboard.total_count&&<Link href={financeHref({...query,page:query.page+1})} className="kk-text-link">次へ →</Link>}</nav>}
   <Link href="/app/finance/categories" className="kk-text-link self-start"><Settings2 aria-hidden="true" size={17}/>分類を追加・名前変更</Link>
   <p className="kk-muted">退出・グループ削除後も、自分の会計はここで振り返れます。月別は受け渡し日ではなく費用の発生日で集計します。</p>
  </>;
}
export default function FinancePage(props:{searchParams:Promise<FinanceSearch>}){return <Suspense fallback={<p role="status" className="kk-loading">自分の会計を読み込んでいます…</p>}><Content {...props}/></Suspense>;}
