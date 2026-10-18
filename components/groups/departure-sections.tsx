import { randomUUID } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import { myDepartures, myDeletionJob } from "@/lib/groups/departures";
import { LeaveGroupForm, DeleteAccountForm } from "./departure-forms";
type Client=Awaited<ReturnType<typeof createClient>>;
export async function GroupDepartureSection({client,groupId}:{client:Client;groupId:string}){
  try{const group=(await myDepartures(client)).find(g=>g.group_id===groupId);return group?<LeaveGroupForm group={group}/>:null;}
  catch{return <p role="alert" className="kk-notice">退出する内容を読み込めませんでした。グループ設定を開き直してください。</p>;}
}
export async function AccountDeletionSection({client}:{client:Client}){
  try{const [groups,job]=await Promise.all([myDepartures(client),myDeletionJob(client)]);return <DeleteAccountForm groups={groups} job={job} requestId={randomUUID()}/>;}
  catch{return <p role="alert" className="kk-notice">アカウント削除の情報を読み込めませんでした。プロフィールを開き直してください。</p>;}
}
