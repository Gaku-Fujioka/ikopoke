import {randomUUID} from 'node:crypto';
import {Suspense} from 'react';
import Link from 'next/link';
import {financeSession} from '@/lib/finance/session';
import {financeOptions} from '@/lib/finance/repository';
import {FinancePrivacy,FinanceFailure} from '@/components/finance/shared';
import {FinanceCategoryForm} from '@/components/finance/forms';
async function Content(){
 const client=await financeSession('/app/finance/categories');
 try{const options=await financeOptions(client);return <><Link href="/app/finance" className="kk-text-link self-start">← 自分の会計へ</Link><header className="kk-page-heading"><h1>自分の分類</h1><FinancePrivacy/><p>分類名を変えると、これまでの自分の明細にも反映します。</p></header>{options.categories.length<50&&<section className="kk-surface"><FinanceCategoryForm requestId={randomUUID()}/></section>}<p className="kk-muted">{options.categories.length} / 50件</p><ul className="space-y-4">{options.categories.map(c=><li key={c.id} className="kk-surface"><FinanceCategoryForm category={c} requestId={c.id}/></li>)}</ul></>;}catch(error){return <FinanceFailure error={error}/>;}
}
export default function CategoriesPage(){return <Suspense fallback={<p role="status" className="kk-loading">分類を読み込んでいます…</p>}><Content/></Suspense>;}
