"use server";
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {hasEnvVars} from '@/lib/utils';
import {revalidateSharedHome} from '@/lib/home/revalidate';
import {BookError,bookInput,bookText} from '@/lib/memories/book';
import {isGroupId} from '@/lib/groups/validation';
import {PHOTO_BUCKET,photoFileInput} from '@/lib/visits/validation';

export type BookState={error:string|null;saved?:boolean;revision?:number;pageId?:string;removed?:boolean};
async function clientForBook(){
 if(!hasEnvVars)throw new BookError('PGRST202');
 const client=await createClient(),{data,error}=await client.auth.getClaims();
 if(error||!data?.claims?.sub)throw new BookError();return client;
}
function refresh(group:string,memory:string){
 revalidatePath(`/app/groups/${group}/memories/${memory}`);revalidatePath(`/app/groups/${group}/memories`);
 revalidatePath('/app/memories');revalidateSharedHome(group,'memories');
}
function failure(error:unknown):BookState{return {error:error instanceof BookError?error.message:'保存できませんでした。通信状態を確認して再試行してください。'};}
export async function saveBookAction(_previous:BookState,form:FormData):Promise<BookState>{
 let input,operation:string,payload:Record<string,unknown>;
 try{
  input=bookInput(form);operation=String(form.get('operation'));
  if(!['add_page','edit_page','save_word','delete_word'].includes(operation))throw new Error('操作を選び直してください。');
  payload={id:input.id,page_id:input.pageId,revision:input.revision};
  if(operation==='add_page'||operation==='edit_page')Object.assign(payload,{title:bookText(form.get('title'),120,operation==='add_page'||form.get('freePage')==='true'),body:bookText(form.get('body'),2000)});
  else if(operation==='save_word')payload.body=bookText(form.get('body'),500,true);
  else {if(form.get('confirm')!=='delete')throw new Error('削除の確認にチェックを入れてください。');payload.confirm=true;}
 }catch(error){return {error:error instanceof Error?error.message:'入力をご確認ください。'};}
 try{
  const client=await clientForBook(),{data,error}=await client.rpc('mutate_memory_book',{p_memory:input.memoryId,p_operation:operation,p_data:payload});
  if(error||!data||typeof data.revision!=='number'||!Number.isSafeInteger(data.revision))throw new BookError(error?.code);
  refresh(input.groupId,input.memoryId);return {error:null,saved:true,revision:data.revision,...(operation==='add_page'?{pageId:input.id}:{}),...(operation==='delete_word'?{removed:true}:{})};
 }catch(error){return failure(error);}
}
export async function bookPhotoAction(form:FormData):Promise<BookState & {reservation?:{photo_id:string;object_path:string;status:'pending'|'ready'|'cancelling'}}>{
 let input,operation:string,payload:Record<string,unknown>;
 try{
  input=bookInput(form);if(!input.pageId)throw new Error('ページを開き直してください。');operation=String(form.get('operation'));
  if(!['reserve_photo','finish_photo','remove_photo','remove_page'].includes(operation))throw new Error('操作を選び直してください。');
  payload={id:input.id,page_id:input.pageId,revision:input.revision};
  if(operation==='reserve_photo'){const file=photoFileInput(String(form.get('contentType')),Number(form.get('byteSize')));Object.assign(payload,{content_type:file.contentType,byte_size:file.byteSize});}
  if(operation==='remove_photo'||operation==='remove_page'){if(form.get('confirm')!=='delete')throw new Error('削除の確認にチェックを入れてください。');payload.confirm=true;}
 }catch(error){return {error:error instanceof Error?error.message:'入力をご確認ください。'};}
 try{
  const client=await clientForBook();
  const mutate=async(op:string)=>{const {data,error}=await client.rpc('mutate_memory_book',{p_memory:input.memoryId,p_operation:op,p_data:payload});if(error||!data)throw new BookError(error?.code);return data;};
  if(operation==='reserve_photo'){
   const data=await mutate(operation);
   if(typeof data.object_path!=='string'||!['pending','ready','cancelling'].includes(data.status??''))throw new BookError();
   return {error:null,reservation:{photo_id:input.id,object_path:data.object_path,status:data.status as 'pending'|'ready'|'cancelling'}};
  }
  if(operation==='finish_photo')await mutate(operation);
  else{
   const page=operation==='remove_page',data=await mutate(page?'begin_remove_page':'begin_remove_photo');
   const paths=page?data.paths:[data.object_path];
   if(!Array.isArray(paths)||paths.length>10||paths.some(path=>typeof path!=='string'||!path.startsWith(`${input.groupId}/${input.pageId}/`)))throw new BookError();
   // Finish verifies absence, including a lost Storage response. Retry never
   // marks a photo/page removed until its private bytes are actually gone.
   if(paths.length)try{await client.storage.from(PHOTO_BUCKET).remove(paths as string[]);}catch{}
   await mutate(page?'finish_remove_page':'finish_remove_photo');
  }
  refresh(input.groupId,input.memoryId);return {error:null,saved:true,removed:operation==='remove_page'};
 }catch(error){return failure(error);}
 finally{if(operation!=='reserve_photo')refresh(input.groupId,input.memoryId);}
}
export async function openBookAction(_previous:BookState,form:FormData):Promise<BookState>{
 const group=form.get('groupId'),outing=form.get('outingId');
 if(!isGroupId(group)||!isGroupId(outing))return {error:'計画を開き直してください。'};
 let id;
 try{const client=await clientForBook(),{data,error}=await client.rpc('open_memory_book',{p_group:group,p_outing:outing});if(error||!isGroupId(data))throw new BookError(error?.code);id=data;refresh(group,id);}catch(error){return failure(error);}
 redirect(`/app/groups/${group}/memories/${id}`);
}
