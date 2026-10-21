"use client";
import {createClient} from "@/lib/supabase/client";
import {finishPhotoAction,reservePhotoAction} from "@/app/app/groups/[groupId]/visits/actions";
import {PHOTO_BUCKET,photoFileInput} from "@/lib/visits/validation";
import {transferVisitPhoto} from "@/lib/visits/photo-transfer";
import type {SelectedVisitPhoto} from "@/lib/visits/creation";

export async function uploadVisitPhotos(groupId:string,visitId:string,photos:SelectedVisitPhoto[],onDone:(id:string)=>void){
  if(!photos.some(photo=>!photo.done))return;
  const client=createClient();
  for(const photo of photos.filter(photo=>!photo.done)){
    const input=photoFileInput(photo.file.type,photo.file.size),form=new FormData();
    for(const [key,value] of Object.entries({groupId,visitId,photoId:photo.id,contentType:input.contentType,byteSize:String(input.byteSize)}))form.set(key,value);
    await transferVisitPhoto({reserve:()=>reservePhotoAction(form),upload:path=>client.storage.from(PHOTO_BUCKET).upload(path,photo.file,{contentType:input.contentType,upsert:false,cacheControl:"0"}),finish:()=>finishPhotoAction(form)});
    onDone(photo.id);
  }
}
