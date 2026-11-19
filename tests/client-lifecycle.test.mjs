import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Drive the actual component functions with controlled hook lifecycles. This is
// not a browser test: providers and commit/unmount timing are explicit boundaries.
const moduleURL = source => `data:text/javascript,${encodeURIComponent(source)}`;
const hooksURL = moduleURL(`
let active;
export function bind(value){active=value;}
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
export function useState(initial){const owner=active,index=owner.cursor++;if(!(index in owner.slots))owner.slots[index]=typeof initial==='function'?initial():initial;return [owner.slots[index],value=>{const next=typeof value==='function'?value(owner.slots[index]):value;if(!Object.is(next,owner.slots[index])){owner.slots[index]=next;owner.dirty=true;}}];}
export function useRef(value){const owner=active,index=owner.cursor++;return owner.slots[index]??(owner.slots[index]={current:value});}
export function useEffect(effect,deps){const owner=active,index=owner.cursor++,previous=owner.effects[index];if(!previous||!same(previous.deps,deps))owner.pending.push(()=>{previous?.cleanup?.();owner.effects[index]={deps,cleanup:effect()};});}
export function useCallback(callback,deps){const owner=active,index=owner.cursor++,previous=owner.slots[index];if(!previous||!same(previous.deps,deps))owner.slots[index]={deps,value:callback};return owner.slots[index].value;}
export function useActionState(action,initial){const [state,setState]=useState(initial);return [state,async form=>{const result=await action(state,form);setState(result);return result;},false];}
`);
const providerURL = moduleURL(`
export let itemResult={error:null};export const requests=[],savedRequests=[];
export function configure(result={error:null}){itemResult=result;requests.length=0;savedRequests.length=0;}
export async function updateItemAction(){return itemResult;}
export async function placeListsAction(){return {lists:[]};}
export async function savePlaceAction(_previous,form){savedRequests.push(Object.fromEntries(form));return {error:'retry'};}
export async function attachPlaceAction(){return {error:null};}
export function createClient(){return {storage:{from(){return {download(path){let resolve;const promise=new Promise(done=>{resolve=done;});requests.push({path,resolve});return promise;}};}}};}
`);
const linkURL = moduleURL("export default function Link(){return null;}");
registerHooks({
  resolve(specifier, context, next) {
    if(specifier==="react"&&(context.parentURL?.includes("/components/")||context.parentURL?.includes("/components/hooks/")))return {url:hooksURL,shortCircuit:true};
    if(specifier==="next/link"||specifier==="next/image")return {url:linkURL,shortCircuit:true};
    if(specifier==="@/lib/supabase/client"||specifier.endsWith("/items/edit-actions")||specifier==="@/app/app/map-actions")return {url:providerURL,shortCircuit:true};
    if(specifier.startsWith("@/")||((specifier.startsWith("./")||specifier.startsWith("../"))&&/\.tsx?$/.test(context.parentURL??""))){
      const base=specifier.startsWith("@/")?new URL(`../${specifier.slice(2)}`,import.meta.url):new URL(specifier,context.parentURL);
      const url=[".ts",".tsx"].map(extension=>base.href+extension).find(value=>existsSync(fileURLToPath(value)));
      if(url)return {url,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith(".tsx"))return {format:"module",source:ts.transpileModule(readFileSync(fileURLToPath(url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const hooks=await import(hooksURL),provider=await import(providerURL);
const {EditItemForm}=await import("../components/items/edit-item-form.tsx");
const {PrivateVisitImage}=await import("../components/visits/private-visit-image.tsx");
const {PlaceSaveForm}=await import("../components/maps/place-save-form.tsx");
const {VisitPhotoPicker}=await import("../components/visits/visit-photo-picker.tsx");
const {useNearbyImage}=await import("../components/hooks/use-nearby-image.ts");
const {createMockSnapshotStore}=await import("../lib/kokoiko/snapshot-store.ts");
const {createMockRepository,MOCK_GROUP_ID}=await import("../lib/kokoiko/mock-repository.ts");
const {createInviteEntrySnapshot,captureInviteEntry}=await import("../lib/groups/invite-entry.ts");
function NearbyImageProbe({margin}){return useNearbyImage(margin);}
function renderer(component,initialProps){
  const owner={slots:[],effects:[],pending:[],cursor:0,dirty:false};let props=initialProps;
  return {
    render(nextProps=props){props=nextProps;let tree;for(let pass=0;pass<15;pass++){owner.cursor=0;owner.dirty=false;hooks.bind(owner);tree=component(props);if(!owner.dirty)return tree;}throw Error("Render did not settle");},
    commit(){const pending=owner.pending.splice(0);pending.forEach(run=>run());},
    unmount(){owner.effects.forEach(effect=>effect?.cleanup?.());},
  };
}
function nodes(tree,predicate){if(tree==null||typeof tree!=="object")return [];if(Array.isArray(tree))return tree.flatMap(node=>nodes(node,predicate));return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
const field=(tree,name)=>nodes(tree,node=>node.props?.name===name)[0];
const memoryStorage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
afterEach(()=>provider.configure());

test("a dirty editor keeps its draft and opened conflict baseline after another member saves",async()=>{
  const props={groupId:"group",itemId:"item",title:"元の名前",memo:"元のメモ"};
  const view=renderer(EditItemForm,props);let tree=view.render();
  field(tree,"title").props.onChange({target:{value:"編集中の名前"}});tree=view.render();
  tree=view.render({...props,title:"別メンバーの名前",memo:"別メンバーのメモ"});
  assert.equal(field(tree,"title").props.value,"編集中の名前");
  assert.equal(field(tree,"memo").props.value,"元のメモ");
  assert.equal(field(tree,"expectedTitle").props.value,"元の名前");
  provider.configure({error:"別の画面で更新されています。"});
  await nodes(tree,node=>node.type==="form")[0].props.action(new FormData());tree=view.render();
  assert.equal(field(tree,"title").props.value,"編集中の名前");
  assert.equal(field(tree,"expectedTitle").props.value,"元の名前");
});

test("a clean editor follows a sibling save, and its own successful save becomes the new baseline",async()=>{
  const props={groupId:"group",itemId:"item",title:"最初",memo:"メモ"};const view=renderer(EditItemForm,props);view.render();
  let tree=view.render({...props,title:"共有された名前"});
  assert.equal(field(tree,"title").props.value,"共有された名前");
  assert.equal(field(tree,"expectedTitle").props.value,"共有された名前");
  provider.configure({error:null,saved:{title:"保存した名前",memo:"保存したメモ"}});
  await nodes(tree,node=>node.type==="form")[0].props.action(new FormData());tree=view.render();
  assert.equal(field(tree,"title").props.value,"保存した名前");
  assert.equal(field(tree,"expectedMemo").props.value,"保存したメモ");
});

test("switching private photos clears the old resource and ignores its late response; retries revoke URLs",async()=>{
  const wrapper=renderer(PrivateVisitImage,{path:"first",contentType:"image/jpeg",alt:"写真"});let element=wrapper.render();
  let attempt=renderer(element.type,element.props);attempt.render();attempt.commit();
  assert.equal(provider.requests[0].path,"first");const firstKey=element.key;
  element=wrapper.render({path:"second",contentType:"image/jpeg",alt:"写真"});assert.notEqual(element.key,firstKey);attempt.unmount();
  attempt=renderer(element.type,element.props);assert.equal(attempt.render().props.role,"status");attempt.commit();
  provider.requests[0].resolve({data:new Blob(["old"]),error:null});await tick();assert.equal(attempt.render().props.role,"status");
  const created=[],revoked=[],originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  URL.createObjectURL=()=>{const url=`blob:test-${created.length}`;created.push(url);return url;};URL.revokeObjectURL=url=>revoked.push(url);
  try{
    provider.requests[1].resolve({data:new Blob(["new"]),error:null});await tick();const ready=attempt.render();assert.equal(nodes(ready,node=>node.props?.src===created[0]).length,2);
    attempt.unmount();assert.deepEqual(revoked,created);
    const oldKey=element.key;element.props.retry();element=wrapper.render();assert.notEqual(element.key,oldKey);
    const retry=renderer(element.type,element.props);assert.equal(retry.render().props.role,"status");retry.commit();provider.requests[2].resolve({data:null,error:{}});await tick();assert.equal(nodes(retry.render(),node=>node.props?.role==="alert").length,1);retry.unmount();
  }finally{URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
});

test("nearby image observation belongs to the mounted node and has a no-observer fallback",()=>{
  const original=globalThis.IntersectionObserver,observations=[];
  globalThis.IntersectionObserver=class{constructor(callback,options){this.callback=callback;this.options=options;observations.push(this);}observe(node){this.node=node;}disconnect(){this.disconnected=true;}};
  try{
    const view=renderer(NearbyImageProbe,{margin:"200px"}),node={};let image=view.render();assert.equal(image.visible,false);
    const cleanup=image.ref(node);assert.equal(observations[0].node,node);observations[0].callback([{isIntersecting:true}]);assert.equal(view.render().visible,true);cleanup();assert.equal(observations[0].disconnected,true);
    delete globalThis.IntersectionObserver;const fallback=renderer(NearbyImageProbe,{margin:"160px"});image=fallback.render();image.ref(node);assert.equal(fallback.render().visible,true);
  }finally{globalThis.IntersectionObserver=original;}
});

test("mock snapshots are lazy on the server, stable between reloads, and publish saved values once",()=>{
  const storage=memoryStorage();let reads=0;const store=createMockSnapshotStore(()=>{reads++;return storage;});
  assert.equal(store.getServerSnapshot().loading,true);assert.equal(reads,0);
  const initial=store.getSnapshot();assert.equal(initial.loading,false);assert.equal(store.getSnapshot(),initial);assert.equal(reads,1);
  let notifications=0;const unsubscribe=store.subscribe(()=>notifications++);
  const created=createMockRepository(storage).createItem(MOCK_GROUP_ID,{kind:"activity",title:"新しい候補"});assert.equal(store.getSnapshot(),initial);
  store.reload();assert.equal(notifications,1);assert.equal(store.getSnapshot().snapshot.items.find(item=>item.id===created.id).title,"新しい候補");assert.equal(store.getSnapshot(),store.getSnapshot());
  unsubscribe();store.reload();assert.equal(notifications,1);
});

test("mock load failures remain errors, can recover, and never share snapshots across store instances",()=>{
  const storage=memoryStorage();let fail=true;const first=createMockSnapshotStore(()=>{if(fail)throw Error("保存領域を読めません");return storage;});
  const error=first.getSnapshot();assert.equal(error.snapshot,null);assert.equal(error.loading,false);assert.match(error.error,/保存領域/);assert.equal(first.getSnapshot(),error);
  fail=false;first.reload();assert.equal(first.getSnapshot().error,null);
  const second=createMockSnapshotStore(memoryStorage);assert.notEqual(first.getSnapshot(),second.getSnapshot());
});

test("an invitation snapshot remains page-local and copyable after URL cleanup without reading during SSR",()=>{
  let reads=0;const browser={location:new URL(`https://www.ikopoke.app/app/groups/join#${"a".repeat(64)}`),history:{replaceState(_s,_t,path){browser.location=new URL(path,browser.location.origin);}}};
  const store=createInviteEntrySnapshot(()=>{reads++;return browser.location;});assert.equal(store.getServerSnapshot(),null);assert.equal(reads,0);
  const entry=store.getSnapshot();captureInviteEntry(browser);assert.equal(browser.location.hash,"");assert.equal(store.getSnapshot(),entry);assert.equal(reads,1);assert.match(entry.handoffLink,/#a{64}$/);
  const anotherPage=createInviteEntrySnapshot(()=>browser.location);assert.equal(anotherPage.getSnapshot(),null);
  const invalid=createInviteEntrySnapshot(()=>new URL("https://www.ikopoke.app/app/groups/join#invalid"));assert.equal(invalid.getSnapshot().handoffLink,null);
});

test("map saves allocate one UUID at submission and retain it for retries, independently per group",async()=>{
  const place={id:'place-id',name:'カフェ'},root=renderer(PlaceSaveForm,{place,query:'検索語',groups:[{id:'group-a',name:'A'}]});
  let element=nodes(root.render(),node=>node.type?.name==='SaveForGroup')[0];const view=renderer(element.type,element.props);
  let tree=view.render();assert.equal(provider.savedRequests.length,0);
  const first=new FormData();first.set('groupId','group-a');first.set('placeId',place.id);await tree.props.action(first);tree=view.render();
  const second=new FormData();second.set('groupId','group-a');second.set('placeId',place.id);await tree.props.action(second);
  assert.match(provider.savedRequests[0].requestId,/^[0-9a-f-]{36}$/);assert.equal(provider.savedRequests[0].requestId,provider.savedRequests[1].requestId);
  const anotherRoot=renderer(PlaceSaveForm,{place,query:'検索語',groups:[{id:'group-b',name:'B'}]});element=nodes(anotherRoot.render(),node=>node.type?.name==='SaveForGroup')[0];
  const another=renderer(element.type,element.props),form=new FormData();form.set('groupId','group-b');await another.render().props.action(form);assert.notEqual(provider.savedRequests[2].requestId,provider.savedRequests[0].requestId);
});

test("local photo preview URLs are created on commit and released when the file changes or unmounts",()=>{
  const first=new File(['first'],'first.jpg',{type:'image/jpeg'}),second=new File(['second'],'second.jpg',{type:'image/jpeg'});
  const picker=renderer(VisitPhotoPicker,{photos:[{id:'photo',file:first}],onChange(){},disabled:false});
  const element=nodes(picker.render(),node=>node.type?.name==='LocalPreview')[0],view=renderer(element.type,element.props);
  const created=[],revoked=[],originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  URL.createObjectURL=file=>{const url=`blob:${file.name}`;created.push(url);return url;};URL.revokeObjectURL=url=>revoked.push(url);
  try{
    let tree=view.render();assert.deepEqual(created,[]);const releaseFirst=tree.props.ref({});tree=view.render();assert.equal(nodes(tree,node=>node.props?.src==='blob:first.jpg').length,1);
    tree=view.render({file:second});releaseFirst();const releaseSecond=tree.props.ref({});tree=view.render();assert.equal(nodes(tree,node=>node.props?.src==='blob:second.jpg').length,1);releaseSecond();assert.deepEqual(revoked,created);
  }finally{URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
});
