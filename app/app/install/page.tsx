import Link from "next/link";
import {InstallCard} from "@/components/pwa/install-card";

export default function InstallPage(){
  return <div className="mx-auto max-w-lg space-y-5"><Link href="/app" className="kk-text-link">← 全体ホームへ</Link><InstallCard/></div>;
}
