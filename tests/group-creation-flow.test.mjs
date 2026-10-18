import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))return {url:new URL('../'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const {completeGroupCreation}=await import('../lib/groups/creation.ts');
const {publishPhoto,normalizePhoto}=await import('../lib/presentation/photo.ts');
const group='10000000-0000-4000-8000-000000000050',id='90000000-0000-4000-8000-000000000050';
const photo={id,groupId:group,expected:null,file:new Blob(['jpeg'],{type:'image/jpeg'})};

test('name-only creation skips photo calls and invalid metadata never starts an upload',async()=>{
 let uploads=0;const form=new FormData(),saved=()=>Promise.resolve({error:null,groupId:group});
 assert.deepEqual(await completeGroupCreation(form,undefined,saved),{error:null,groupId:group});
 const invalid=await completeGroupCreation(form,undefined,async()=>({error:'名前を確認'}),async()=>{uploads++;});
 assert.equal(invalid.error,'名前を確認');assert.equal(uploads,0);
});
test('a photo failure preserves the committed group; retry saves the same photo without creating a second group',async()=>{
 let creates=0,attempts=0;const ids=[];
 const create=async()=>{creates++;return {error:null,groupId:group};};
 const save=async gid=>{ids.push(gid);attempts++;if(attempts===1)throw Error('private provider detail');};
 const first=await completeGroupCreation(new FormData(),undefined,create,save);
 assert.equal(first.groupId,group);assert.match(first.error,/保存済み/);assert.ok(!first.error.includes('private'));
 const second=await completeGroupCreation(new FormData(),first.groupId,create,save);
 assert.equal(second.error,null);assert.equal(creates,1);assert.deepEqual(ids,[group,group]);
});
test('lost upload responses are finalized through the DB; an already-ready retry does not reupload',async()=>{
 const operations=[];let uploads=0,ready=false;
 const edit=async form=>{operations.push(Object.fromEntries(form));return {error:null,path:`profile-cover/${group}/${id}.jpg`,status:ready?'ready':'pending'};};
 const upload=async()=>{uploads++;throw Error('response lost after writing bytes');};
 await publishPhoto(photo,edit,upload);ready=true;await publishPhoto(photo,edit,upload);
 assert.equal(uploads,1);assert.deepEqual(operations.map(x=>x.operation),['reserve','publish','reserve','publish']);
 assert.ok(operations.every(x=>x.mediaId===id&&x.groupId===group&&x.kind==='cover'));
 assert.equal(operations[0].byteSize,'4');
});
test('reservation or completion failure never appears as a finished photo',async()=>{
 let uploads=0;
 await assert.rejects(publishPhoto(photo,async()=>({error:'予約できません'}),async()=>{uploads++;}),/予約/);assert.equal(uploads,0);
 await assert.rejects(publishPhoto(photo,async f=>f.get('operation')==='reserve'?{error:null,path:'reserved'}:{error:'送信未完了'},async()=>{uploads++;}),/送信未完了/);assert.equal(uploads,1);
});
test('normalization validates original files before decoding and reencodes within the saved image limits',async()=>{
 const oldBitmap=globalThis.createImageBitmap,oldDocument=globalThis.document;let closed=0,decoded=0;const calls=[];
 const canvas={width:0,height:0,getContext:()=>({set fillStyle(v){calls.push(v);},fillRect:(...args)=>calls.push(args),drawImage:()=>calls.push('draw')}),toBlob:(callback,mime,quality)=>{calls.push([mime,quality]);callback(new Blob(['normalized'],{type:mime}));}};
 globalThis.createImageBitmap=async()=>{decoded++;return {width:3200,height:1600,close:()=>{closed++;}};};globalThis.document={createElement:()=>canvas};
 try {
  await assert.rejects(normalizePhoto(new File(['bad'],'x.svg',{type:'image/svg+xml'})));assert.equal(decoded,0);
  await assert.rejects(normalizePhoto(new File([new Uint8Array(10485761)],'large.jpg',{type:'image/jpeg'})));assert.equal(decoded,0);
  const output=await normalizePhoto(new File(['original'],'x.png',{type:'image/png'}));
  assert.equal(canvas.width,1600);assert.equal(canvas.height,800);assert.equal(output.type,'image/jpeg');assert.equal(await output.text(),'normalized');assert.equal(closed,1);assert.deepEqual(calls.at(-1),['image/jpeg',.82]);assert.ok(calls.includes('#fff'));
  globalThis.createImageBitmap=async()=>({width:10000,height:10000,close:()=>{closed++;}});
  await assert.rejects(normalizePhoto(new File(['x'],'x.jpg',{type:'image/jpeg'})),/大きすぎ/);assert.equal(closed,2);
 }finally{if(oldBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=oldBitmap;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
