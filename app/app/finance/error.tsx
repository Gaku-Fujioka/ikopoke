"use client";
import Link from 'next/link';
export default function FinanceErrorPage({reset}:{reset:()=>void}){return <div role="alert" className="kk-notice space-y-4"><p>会計を読み込めませんでした。通信状態をご確認ください。</p><button onClick={reset} className="kk-primary-link">もう一度読み込む</button><Link href="/app/profile" className="kk-text-link">プロフィールへ</Link></div>;}
