import { randomUUID } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import { myDepartures, myDeletionJob } from "@/lib/groups/departures";
import { LeaveGroupForm, DeleteAccountForm } from "./departure-forms";
type Client=Awaited<ReturnType<typeof createClient>>;
export async function GroupDepartureSection({client,groupId}:{client:Client;groupId:string}){
  let group;
  try {
    group = (await myDepartures(client)).find(g=>g.group_id===groupId);
  } catch{return <p role="alert" className="kk-notice">退出する内容を読み込めませんでした。グループ設定を開き直してください。</p>;}
  return group?<LeaveGroupForm group={group}/>:null;
}
export async function AccountDeletionSection({client}:{client:Client}){
  let groups, job;
  try {
    [groups,job] = await Promise.all([myDepartures(client),myDeletionJob(client)]);
  } catch{return <p role="alert" className="kk-notice">アカウント削除の情報を読み込めませんでした。プロフィールを開き直してください。</p>;}
  return <DeleteAccountForm groups={groups} job={job} requestId={randomUUID()}/>;
}
