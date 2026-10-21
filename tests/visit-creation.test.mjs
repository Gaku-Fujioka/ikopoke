import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';
const stubURL='data:text/javascript,'+encodeURIComponent(`export const calls=[];let fail=true;export function reset(){calls.length=0;fail=true;}export function createClient(){return {storage:{from:bucket=>({upload:async(path,file,options)=>{calls.push(['upload',bucket,path,options]);return {error:null};}})}};}export async function reservePhotoAction(form){calls.push(['reserve',form.get('visitId'),form.get('photoId')]);return {error:null,reservation:{photo_id:form.get('photoId'),object_path:'reserved/'+form.get('photoId'),status:'pending'}};}export async function finishPhotoAction(form){calls.push(['finish',form.get('photoId')]);if(fail&&calls.filter(c=>c[0]==='finish').length===2){fail=false;return {error:'送信未完了'};}return {error:null};}`);
registerHooks({resolve(s,c,next){if(['@/lib/supabase/client','@/app/app/groups/[groupId]/visits/actions'].includes(s))return {url:stubURL,shortCircuit:true};if(s.startsWith('@/'))return {url:new URL('../'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const {completeVisitCreation,selectVisitPhotos}=await import('../lib/visits/creation.ts');
const {uploadVisitPhotos}=await import('../components/visits/upload-visit-photos.ts');
const stub=await import(stubURL);
const file=()=>new File(['image'],'photo.jpg',{type:'image/jpeg'});

test('photo selection appends stable IDs and rejects oversize, HEIC and the eleventh photo without discarding the selection',()=>{
  const first=selectVisitPhotos([], [file()]);const next=selectVisitPhotos(first,[file()]);
  assert.equal(first[0],next[0]);assert.notEqual(next[0].id,next[1].id);
  const ten=selectVisitPhotos(next,Array.from({length:8},file));
  assert.throws(()=>selectVisitPhotos(ten,[file()]),/10枚/);assert.equal(ten.length,10);
  assert.throws(()=>selectVisitPhotos(first,[new File(['x'],'x.heic',{type:'image/heic'})]),/JPEG/);
  assert.throws(()=>selectVisitPhotos(first,[new File([new Uint8Array(10485761)],'x.jpg',{type:'image/jpeg'})]),/10MB/);
  assert.equal(first.length,1);
});
test('metadata failure prevents photo writes and private provider errors stay private',async()=>{
  let uploads=0,saved=0;
  const result=await completeVisitCreation(undefined,async()=>({error:'入力を確認'}),async()=>{uploads++;},()=>{saved++;});
  assert.equal(result.error,'入力を確認');assert.equal(uploads,0);assert.equal(saved,0);
  const lost=await completeVisitCreation(undefined,async()=>{throw Error('private provider');},async()=>{uploads++;},()=>{});
  assert.ok(!lost.error.includes('private'));assert.equal(lost.visitId,undefined);assert.equal(uploads,0);
});
test('a partial photo failure preserves one visit and stable photo IDs; retry skips confirmed photos',async()=>{
  const photos=selectVisitPhotos([],[file(),file()]);let creates=0,attempt=0;const sent=[],saved=[];
  const save=async()=>{creates++;return {error:null,visitId:'saved-visit'};};
  const upload=async id=>{assert.equal(id,'saved-visit');for(const photo of photos.filter(p=>!p.done)){sent.push(photo.id);if(++attempt===2)throw Error('private provider');photo.done=true;}};
  const first=await completeVisitCreation(undefined,save,upload,id=>saved.push(id));
  assert.match(first.error,/訪問記録は保存済み/);assert.ok(!first.error.includes('private'));assert.equal(first.visitId,'saved-visit');assert.deepEqual(saved,['saved-visit']);
  const second=await completeVisitCreation(first.visitId,save,upload,()=>assert.fail('must reuse visit'));
  assert.equal(second.error,null);assert.equal(creates,1);assert.deepEqual(sent,[photos[0].id,photos[1].id,photos[1].id]);
});
test('photo-free creation completes in one save and never reports a failed transfer as success',async()=>{
  const order=[];
  const result=await completeVisitCreation(undefined,async()=>{order.push('save');return {error:null,visitId:'visit'};},async()=>{order.push('upload');},()=>order.push('saved'));
  assert.deepEqual(order,['save','saved','upload']);assert.deepEqual(result,{error:null,visitId:'visit'});
  assert.ok((await completeVisitCreation('visit',()=>assert.fail(),async()=>{throw Error();},()=>{})).error);
});
test('real upload queue confirms each reservation, retries the same remaining ID and never overwrites Storage',async()=>{
  stub.reset();const photos=selectVisitPhotos([],[file(),file()]);
  const done=id=>{photos.find(photo=>photo.id===id).done=true;};
  await assert.rejects(uploadVisitPhotos('group','visit',photos,done),/送信未完了/);
  assert.equal(photos[0].done,true);assert.equal(photos[1].done,false);
  await uploadVisitPhotos('group','visit',photos,done);
  assert.deepEqual(stub.calls.filter(c=>c[0]==='reserve').map(c=>c.slice(1)),[['visit',photos[0].id],['visit',photos[1].id],['visit',photos[1].id]]);
  assert.ok(stub.calls.filter(c=>c[0]==='upload').every(c=>c[1]==='visit-photos'&&c[3].upsert===false&&c[3].cacheControl==='0'));
  assert.ok(photos.every(photo=>photo.done));
});
