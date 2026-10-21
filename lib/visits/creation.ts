import {PHOTO_LIMIT,photoFileInput} from "@/lib/visits/validation";

export type SelectedVisitPhoto={id:string;file:File;done:boolean};
export function selectVisitPhotos(current:SelectedVisitPhoto[],files:File[]):SelectedVisitPhoto[]{
  if(current.length+files.length>PHOTO_LIMIT)throw new Error("写真は1回の訪問につき10枚までです。");
  for(const file of files)photoFileInput(file.type,file.size);
  return [...current,...files.map(file=>({id:crypto.randomUUID(),file,done:false}))];
}

/** Preserve the committed visit when photo transfer fails; retries never create another visit. */
export async function completeVisitCreation(
  savedId:string|undefined,
  save:()=>Promise<{error:string|null;visitId?:string}>,
  upload:(visitId:string)=>Promise<void>,
  onSaved:(visitId:string)=>void,
):Promise<{error:string|null;visitId?:string}>{
  let visitId=savedId;
  try{
    if(!visitId){
      const result=await save();
      if(result.error||!result.visitId)return {error:result.error??"訪問記録を保存できませんでした。"};
      visitId=result.visitId;onSaved(visitId);
    }
    await upload(visitId);
    return {error:null,visitId};
  }catch{
    return {visitId,error:visitId?"訪問記録は保存済みですが、写真の保存が完了していません。残りの写真を再試行できます。":"訪問記録を保存できませんでした。通信状態を確認して、もう一度お試しください。"};
  }
}
