import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const url=s=>`data:text/javascript,${encodeURIComponent(s)}`;
const actions=url('export async function saveBookAction(){return {error:null};}export async function bookPhotoAction(){return {error:null};}export async function openBookAction(){return {error:null};}');
registerHooks({resolve(s,c,next){
 if(s==='react'&&c.parentURL?.startsWith('data:'))return next(s,{...c,parentURL:import.meta.url});
 if(s==='@/app/app/groups/[groupId]/memories/book-actions')return {url:actions,shortCircuit:true};
 if(s==='@/lib/supabase/client')return {url:url('export function createClient(){throw Error("no real provider in SSR");}'),shortCircuit:true};
 if(s==='next/navigation')return {url:url('export function useRouter(){return {refresh(){}};}'),shortCircuit:true};
 if(s==='next/link')return {url:url("import {createElement} from 'react';export default function Link({href,children,...p}){return createElement('a',{href,...p},children);}"),shortCircuit:true};
 if(s==='next/image')return {url:url("import {createElement} from 'react';export default function Image({unoptimized,...p}){return createElement('img',p);}"),shortCircuit:true};
 if(s.startsWith('@/')){const base=new URL('../'+s.slice(2),import.meta.url),found=['.ts','.tsx'].map(ext=>base.href+ext).find(v=>existsSync(fileURLToPath(v)));if(found)return {url:found,shortCircuit:true};}
 if(s.startsWith('./')&&c.parentURL?.endsWith('.tsx')){const base=new URL(s,c.parentURL),found=['.tsx','.ts'].map(ext=>base.href+ext).find(v=>existsSync(fileURLToPath(v)));if(found)return {url:found,shortCircuit:true};}
 return next(s,c);
},load(p,c,next){if(p.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(p),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(p,c);}});
const {BookWords,BookPageEditor,InsertBookPage,BookPhotoUpload,RemoveBookPage}=await import('../components/memories/book-writing.tsx');
const {MemoryBook}=await import('../components/memories/memory-book.tsx');
const {bookChapters}=await import('../lib/memories/book.ts');
const id=n=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const memory={id:id(1),group_id:id(2),outing_id:id(3),title:'雨でも楽しかった',memory_date:'2026-10-18',memory_end_date:'2026-10-18',note:'あとがき',revision:1,cover_photo_id:null};
const visit={id:id(4),item_title:'カフェ',visited_on:'2026-10-18'};
const free={id:id(5),visit_id:null,after_visit_id:visit.id,position:1,title:'帰り道',body:'アイスを半分こ',revision:1,deleting:false,can_delete:true};
const render=(Component,props)=>renderToStaticMarkup(createElement(Component,props));
test('book chapters keep visit order, custom insertion points, independent titles and removed-anchor pages',()=>{
 const second={...visit,id:id(7),item_title:'海'},first={...free,id:id(6),after_visit_id:null};
 const rows=bookChapters([visit,second],[free,first,{...free,id:visit.id,visit_id:visit.id,title:'プリンの午後',body:'',after_visit_id:null},{...free,id:id(8),after_visit_id:id(99)}]);
 assert.deepEqual(rows.map(p=>p.title),['帰り道','帰り道','プリンの午後','帰り道','海']);assert.equal(visit.item_title,'カフェ');
 assert.equal(bookChapters([visit],[{...free,id:visit.id,visit_id:visit.id,title:''}])[0].title,'カフェ');
});
test('page words and guestbook show author names and escaped text; only own words expose edit controls',()=>{
 const words=[{id:id(9),page_id:free.id,body:'<script>hello</script>',revision:1,created_at:'2026-10-18T00:00:00Z',is_mine:false,author_name:'はる'},{id:id(10),page_id:null,body:'また行こう',revision:1,created_at:'2026-10-18T00:00:00Z',is_mine:true,author_name:'あおい'}];
 const page=render(BookWords,{memory,pageId:free.id,words});assert.match(page,/このページへのひとこと/);assert.match(page,/はる/);assert.match(page,/&lt;script&gt;/);assert.ok(!page.includes('自分のひとことを編集'));assert.ok(!page.includes('また行こう'));
 const guest=render(BookWords,{memory,pageId:null,words});assert.match(guest,/みんなの寄せ書き/);assert.match(guest,/あおい（あなた）/);assert.match(guest,/自分のひとことを編集/);assert.match(guest,/削除の確認|このひとことを削除する/);
});
test('chapter editors explain original-name preservation, free pages have optional body/photos, and removal explains collateral data',()=>{
 const edit=render(BookPageEditor,{memory,page:{...free,id:visit.id,visit_id:visit.id}});assert.match(edit,/元の訪問先の名前に戻ります/);
 const insert=render(InsertBookPage,{memory,afterId:visit.id,onAdded(){}});assert.match(insert,/このあとにページを足す/);assert.match(insert,/写真なしでも残せます/);assert.match(insert,/章の名前/);
 const upload=render(BookPhotoUpload,{memory,page:free});assert.match(upload,/1ページ10枚/);assert.match(upload,/image\/jpeg/);
 const remove=render(RemoveBookPage,{memory,page:free,onRemoved(){}});assert.match(remove,/みんなが書いたひとことも削除/);assert.match(remove,/required/);
});
test('cover works with no photos or visits and counts inserted pages without asking everyone to finish',()=>{
 const html=render(MemoryBook,{memory,visits:[],photos:[],book:{pages:[free],words:[],photos:[]}});assert.match(html,/雨でも楽しかった/);assert.match(html,/自由ページ 1枚/);assert.match(html,/この本をひらく/);assert.ok(!html.includes('全員が書'));
});
