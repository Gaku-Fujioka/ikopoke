"use client";
import {Check,Download,Share} from "lucide-react";
import {PocketMark} from "@/components/brand/pocket-mark";
import {usePwa} from "./pwa-provider";

export function InstallCard(){
  const {state,install}=usePwa();
  return <section className="kk-install-card">
    <PocketMark className="kk-install-mark"/>
    <p className="kk-eyebrow">いつもの楽しみを、すぐそばに。</p><h1>いこポケを<br/>ホーム画面へ。</h1>
    <p>行きたいをひとつ、ポケットに。<br/>おでかけの先に、思い出が増えていく。</p>
    {state.installed?<p className="kk-installed" role="status"><Check aria-hidden="true" size={20}/>ホーム画面への追加はできています。</p>:<>
      {state.canInstall&&<button type="button" disabled={state.busy||state.offline} onClick={()=>void install()} className="kk-primary-link"><Download size={18} aria-hidden="true"/>{state.busy?"追加の確認中…":"ホーム画面に追加する"}</button>}
      <div className="kk-install-instructions"><h2>{state.ios?"iPhone・iPadで追加する":"ブラウザのメニューからも追加できます"}</h2>
        {state.ios?<ol><li>Safariでいこポケを開く</li><li><Share size={16} aria-hidden="true"/>共有メニューを開く</li><li>「ホーム画面に追加」を選ぶ</li><li>名前を確認して「追加」</li></ol>:<p>ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。ブラウザによって表示が異なります。</p>}
      </div>
    </>}
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    <p className="kk-install-note">記録の読み込みや保存にはインターネット接続が必要です。</p>
  </section>;
}
