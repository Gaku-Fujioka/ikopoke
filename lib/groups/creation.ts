import {isGroupId} from "@/lib/groups/validation";

export type NewGroupResult={error:string|null;groupId?:string;fieldError?:boolean};
/** Keep a saved group's ID on photo failure; retry only the unfinished step. */
export async function completeGroupCreation(form:FormData,groupId:string|undefined,saveGroup:(form:FormData)=>Promise<NewGroupResult>,savePhoto?:(groupId:string)=>Promise<void>):Promise<NewGroupResult>{
  const group=groupId?{error:null,groupId}:await saveGroup(form);
  if(group.error||!isGroupId(group.groupId))return group.error?group:{error:"グループを保存できませんでした。もう一度お試しください。"};
  try { if(savePhoto)await savePhoto(group.groupId); }
  catch {return {error:"グループと説明は保存済みです。写真を保存できませんでした。再試行するか、写真は後から設定できます。",groupId:group.groupId};}
  return {error:null,groupId:group.groupId};
}
