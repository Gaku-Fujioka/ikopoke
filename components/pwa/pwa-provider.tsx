"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {initialPwaState,startPwa,type PwaState} from "@/lib/pwa/client";

const PwaContext=createContext<{state:PwaState;install:()=>Promise<void>;update:()=>void}|null>(null);
export function PwaProvider({children}:{children:ReactNode}){
  const [state,setState]=useState(initialPwaState),controller=useRef<ReturnType<typeof startPwa>|null>(null);
  useEffect(()=>{const current=startPwa(window,navigator,document,setState);controller.current=current;return()=>{current.dispose();controller.current=null;};},[]);
  return <PwaContext.Provider value={{state,install:async()=>{await controller.current?.install();},update:()=>controller.current?.update()}}>{children}</PwaContext.Provider>;
}
export function usePwa(){const context=useContext(PwaContext);if(!context)throw new Error("PwaProvider is required");return context;}
export function PwaStatus(){
  const {state,update}=usePwa();
  if(!state.offline&&!state.waiting)return null;
  return <aside className="kk-pwa-status" aria-label="いこポケの接続と更新">
    {state.offline&&<p role="status">いまは通信できません。入力を残したまま、接続が戻るのをお待ちください。</p>}
    {state.waiting&&!state.offline&&<div><p>新しいいこポケが届きました。<small>入力中の内容を保存してから更新してください。</small></p><button type="button" disabled={state.busy} onClick={update}>{state.busy?"更新しています…":"更新して開き直す"}</button></div>}
    {state.error&&<p role="alert">{state.error}</p>}
  </aside>;
}
