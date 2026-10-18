export type PhotoRequest={id:string;file:Blob;expected:string|null;groupId?:string};
type MediaResult={error:string|null;path?:string;status?:string};
export function photoForm(operation:string,photo:PhotoRequest):FormData{
  const form=new FormData();form.set("operation",operation);form.set("kind",photo.groupId?"cover":"avatar");
  if(photo.groupId)form.set("groupId",photo.groupId);form.set("mediaId",photo.id);
  if(photo.expected)form.set("expectedId",photo.expected);
  if(operation==="reserve")form.set("byteSize",String(photo.file.size));return form;
}
export async function publishPhoto(photo:PhotoRequest,edit:(form:FormData)=>Promise<MediaResult>,upload:(path:string,file:Blob)=>Promise<unknown>):Promise<void>{
  const reserved=await edit(photoForm("reserve",photo));
  if(reserved.error||!reserved.path)throw new Error(reserved.error||"写真を送信できませんでした。");
  // A lost upload response may still mean success; publication verifies actual bytes.
  if(reserved.status!=="ready")try{await upload(reserved.path,photo.file);}catch{}
  const published=await edit(photoForm("publish",photo));if(published.error)throw new Error(published.error);
}
export async function normalizePhoto(file:File):Promise<Blob>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)throw new Error("JPEG・PNG・WebPの10MB以内の写真を選んでください。");
 const bitmap=await createImageBitmap(file);try{
  if(bitmap.width*bitmap.height>40000000)throw new Error("写真が大きすぎます。小さくしてから選んでください。");
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");if(!context)throw new Error("写真を変換できませんでした。");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const image=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("写真を変換できませんでした。")),"image/jpeg",.82));
  if(image.size>2097152)throw new Error("写真を2MB以内に変換できませんでした。小さい写真を選んでください。");return image;
 }finally{bitmap.close();}
}
