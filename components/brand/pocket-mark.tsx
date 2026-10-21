import {pocketMark} from "@/lib/brand/pocket-mark";

export function PocketMark({className}:{className?:string}){
  return <svg viewBox="80 122 352 324" className={className} aria-hidden="true" focusable="false" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={pocketMark.outline} fill="#ffae45" stroke="#202124" strokeWidth="10"/>
    <path d={pocketMark.seam} stroke="#8b4b00" strokeWidth="4" strokeDasharray="5 10"/>
    <path d={pocketMark.letter} stroke="#202124" strokeWidth="18"/>
  </svg>;
}
