"use client";
import {useState} from "react";
const field="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700";
export function VisitTimeFields({time,period,onChange,disabled=false}:{time:string;period:string;onChange:(time:string,period:string)=>void;disabled?:boolean}){
  const [kind,setKind]=useState(time?"exact":period?"period":"none");
  return <fieldset disabled={disabled} className="min-w-0 space-y-3"><legend className="mb-2 font-semibold">訪問した時間（任意）</legend>
    <label className="block space-y-2"><span className="text-sm">時間の指定方法</span><select value={kind} onChange={e=>{setKind(e.target.value);onChange("","");}} className={field}><option value="none">指定なし</option><option value="exact">時刻</option><option value="period">時間帯</option></select></label>
    {kind==="exact"?<label className="block space-y-2"><span className="text-sm">訪問時刻</span><input type="time" name="time" value={time} onChange={e=>onChange(e.target.value,"")} className={field}/></label>:<input type="hidden" name="time" value=""/>}
    {kind==="period"?<label className="block space-y-2"><span className="text-sm">訪問の時間帯</span><select name="period" value={period} onChange={e=>onChange("",e.target.value)} className={field}><option value="">選択してください</option><option value="morning">午前</option><option value="noon">昼</option><option value="afternoon">午後</option><option value="night">夜</option></select></label>:<input type="hidden" name="period" value=""/>}
  </fieldset>;
}
