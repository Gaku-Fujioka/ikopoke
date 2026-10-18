export class PhotoTransferError extends Error {}
type Reservation={photo_id:string;object_path:string;status:"pending"|"ready"|"cancelling"};
/** Retry the same reservation; only confirmed Storage metadata means success. */
export async function transferVisitPhoto(steps:{
  reserve:()=>Promise<{error:string|null;reservation?:Reservation}>;
  upload:(path:string)=>Promise<unknown>;
  finish:()=>Promise<{error:string|null}>;
}):Promise<void>{
  const reserved=await steps.reserve();
  if(reserved.error||!reserved.reservation)throw new PhotoTransferError(reserved.error??"写真を追加できませんでした。");
  if(reserved.reservation.status==="ready")return;
  if(reserved.reservation.status==="cancelling")throw new PhotoTransferError("中断処理を完了してから写真を選び直してください。");
  // A lost upload response can still mean success. Always verify independently.
  try{await steps.upload(reserved.reservation.object_path);}catch{}
  const finished=await steps.finish();
  if(finished.error)throw new PhotoTransferError(finished.error);
}
