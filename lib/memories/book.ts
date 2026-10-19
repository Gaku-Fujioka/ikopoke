import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/supabase/database.types';
import type {SavedVisit,VisitPhoto} from '@/lib/visits/repository';
import {isGroupId} from '@/lib/groups/validation';

export type BookPage = {id:string;visit_id:string|null;after_visit_id:string|null;position:number;title:string;body:string;revision:number;deleting:boolean;can_delete:boolean};
export type BookWord = {id:string;page_id:string|null;body:string;revision:number;created_at:string;is_mine:boolean;author_name:string};
export type BookPhoto = VisitPhoto & {memory_page_id:string;can_delete:boolean};
export type BookContent = {pages:BookPage[];words:BookWord[];photos:BookPhoto[]};
export class BookError extends Error {
 constructor(code?:string){super(code==='40001'?'別の画面で変更されています。入力を控えてから再読み込みしてください。':code==='54000'?'保存できる上限に達しています。自由ページは100枚、ひとことは一冊1000件、写真は1ページ10枚までです。':code==='23505'?'保存済みの内容と異なります。再読み込みしてご確認ください。':code==='PGRST202'||code==='42P01'?'本の書き足し機能は準備中です。しばらくしてから開き直してください。':'思い出を保存できませんでした。所属と通信状態を確認して、もう一度お試しください。');}
}
export async function getBookContent(client:SupabaseClient<Database>,memoryId:string):Promise<BookContent>{
 const {data,error}=await client.rpc('get_memory_book',{p_memory:memoryId});
 if(error||!data||!Array.isArray(data.pages)||!Array.isArray(data.words)||!Array.isArray(data.photos))throw new BookError(error?.code);
 if(data.pages.some(p=>!isGroupId(p.id)||typeof p.title!=='string'||typeof p.body!=='string'||!Number.isSafeInteger(p.revision))||data.words.some(w=>!isGroupId(w.id)||typeof w.body!=='string'||typeof w.author_name!=='string'||typeof w.is_mine!=='boolean')||data.photos.some(p=>!isGroupId(p.id)||!isGroupId(p.memory_page_id)||typeof p.object_path!=='string'||typeof p.can_delete!=='boolean'))throw new BookError();
 return data;
}
/** Free pages follow their anchor visit; a removed anchor moves them to the start. */
export function bookChapters(visits:SavedVisit[],saved:BookPage[]):BookPage[]{
 const custom=saved.filter(p=>p.visit_id===null).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
 const ids=new Set(visits.map(v=>v.id));
 const result=custom.filter(p=>p.after_visit_id===null||!ids.has(p.after_visit_id));
 for(const visit of visits){
  const override=saved.find(p=>p.visit_id===visit.id);
  result.push(override?{...override,title:override.title||visit.item_title}:{id:visit.id,visit_id:visit.id,after_visit_id:null,position:0,title:visit.item_title,body:'',revision:0,deleting:false,can_delete:false});
  result.push(...custom.filter(p=>p.after_visit_id===visit.id));
 }
 return result;
}
export function bookInput(form:FormData){
 const memoryId=form.get('memoryId'),groupId=form.get('groupId'),id=form.get('id'),rawPage=form.get('pageId'),pageId=rawPage===''||rawPage===null?null:rawPage;
 const revision=Number(form.get('revision'));
 if(!isGroupId(memoryId)||!isGroupId(groupId)||!isGroupId(id)||(pageId!==null&&!isGroupId(pageId))||!Number.isSafeInteger(revision)||revision<0)throw new Error('画面を開き直して入力してください。');
 return {memoryId,groupId,id,pageId,revision};
}
export function bookText(value:FormDataEntryValue|null,limit:number,required=false){
 if(typeof value!=='string')throw new Error('入力をご確認ください。');
 const normalized=value.trim();
 if((required&&!normalized)||[...normalized].length>limit)throw new Error(`${required?'1〜':''}${limit}文字以内で入力してください。`);
 return normalized;
}
