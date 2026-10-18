import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {registerHooks} from "node:module";
import {fileURLToPath} from "node:url";
import {beforeEach,test} from "node:test";
import {setImmediate} from "node:timers/promises";
import {Suspense} from "react";
import ts from "typescript";

// Execute the real async Server Component functions and inspect their React
// trees. This verifies wait/error boundaries, not browser streaming or timings.
const moduleURL=source=>`data:text/javascript,${encodeURIComponent(source)}`;
const providerURL=moduleURL(`
export const calls=[];let plan={};export function configure(value){plan=value;calls.length=0;}
export class GroupStoreError extends Error{};export class ItemStoreError extends Error{};export class ReactionError extends Error{};export class InviteError extends Error{};export class CommentError extends Error{};export class ListStoreError extends Error{};
export const ITEM_PAGE_SIZE=20,COMMENT_PAGE_SIZE=20;
export async function createClient(){return {auth:{getClaims:async()=>{calls.push(['auth']);return {data:plan.signedOut?null:{claims:{sub:'synthetic-user'}},error:null};}}};}
export async function getGroup(client,id){calls.push(['group',id]);return plan.group();}
export async function getItem(client,group,item){calls.push(['item',group,item]);return plan.item();}
export async function listItems(client,...args){calls.push(['items',...args]);return plan.items();}
export async function getReactions(client,...args){calls.push(['reactions',...args]);return plan.reactions();}
export async function getNamedComments(client,...args){calls.push(['comments',...args]);return plan.comments();}
export async function listInvites(client,...args){calls.push(['invites',...args]);return plan.invites();}
export async function getItemLists(client,...args){calls.push(['lists',...args]);return plan.lists();}
`);
const leafURL=moduleURL("export function ItemPlaceSection(){return null;}export function CandidateBoard(){return null;}export function CommentManagement(){return null;}export function ItemManagement(){return null;}export function ItemExtraFilters(){return null;}export function PrivatePhotoPreview(){return null;}export function PrivateVisitImage(){return null;}export function GroupDepartureSection(){return null;}export function AuthSetupNotice(){return null;}export function CreateItemForm(){return null;}export function RetryItems(){return null;}export function EditItemForm(){return null;}export function ItemReactions(){return null;}export function CommentForm(){return null;}export function InviteManagement(){return null;}export function RenameGroupForm(){return null;}export function ItemListButton(){return null;}export function VisitHistory(){return null;}export default function Link(){return null;}");
const navigationURL=moduleURL("export function notFound(){const error=new Error('not found');error.navigation='not-found';throw error;}export function redirect(path){const error=new Error('redirect');error.location=path;throw error;}");
registerHooks({
  resolve(specifier,context,next){
    if(specifier==="@/lib/utils")return {url:moduleURL("export const hasEnvVars=true;"),shortCircuit:true};
    if(["@/lib/supabase/server","@/lib/groups/repository","@/lib/items/repository","@/lib/items/reactions","@/lib/items/comments","@/lib/groups/invitations","@/lib/lists/repository"].includes(specifier))return {url:providerURL,shortCircuit:true};
    if(specifier==="next/navigation")return {url:navigationURL,shortCircuit:true};
    if(specifier==="next/link"||(specifier.startsWith("@/components/")&& !["@/components/items/item-comments","@/components/items/item-reaction-section","@/components/lists/item-lists","@/components/home/collection-cards"].includes(specifier)))return {url:leafURL,shortCircuit:true};
    if(specifier.startsWith("@/"))return {url:new URL(`../${specifier.slice(2)}${specifier.startsWith("@/components/")?".tsx":".ts"}`,import.meta.url).href,shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith(".tsx"))return {format:"module",source:ts.transpileModule(readFileSync(fileURLToPath(url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {default:Detail}=await import("../app/app/groups/[groupId]/items/[itemId]/page.tsx");
const {default:List}=await import("../app/app/groups/[groupId]/items/page.tsx");
const {default:Group}=await import("../app/app/groups/[groupId]/settings/page.tsx");
const {ItemReactionSection}=await import("../components/items/item-reaction-section.tsx");
const {ItemComments}=await import("../components/items/item-comments.tsx");
const {ItemLists}=await import("../components/lists/item-lists.tsx");
const provider=await import(providerURL);
const groupId="10000000-0000-4000-8000-000000000001",itemId="20000000-0000-4000-8000-000000000001";
const group={id:groupId,name:"テストグループ"},item={id:itemId,group_id:groupId,title:"テスト候補",kind:"spot",memo:"メモ"};
const props=()=>({params:Promise.resolve({groupId,itemId}),searchParams:Promise.resolve({})});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function walk(node,predicate){if(!node||typeof node!=="object")return [];const children=Array.isArray(node)?node:[node.props?.children];return [...(!Array.isArray(node)&&predicate(node)?[node]:[]),...children.flatMap(child=>walk(child,predicate))];}
function text(node){if(typeof node==="string"||typeof node==="number")return String(node);if(!node||typeof node!=="object")return "";return (Array.isArray(node)?node:[node.props?.children]).map(text).join(" ");}
function content(Page,input=props()){const tree=Page(input);const boundary=tree.type===Suspense?tree:walk(tree,node=>node.type===Suspense)[0];return boundary.props.children.type(boundary.props.children.props);}
beforeEach(()=>provider.configure({group:()=>group,item:()=>item,items:()=>({items:[],total:0}),reactions:()=>({want_count:0,not_now_count:0,my_reaction:null}),comments:()=>({comments:[],total:0}),lists:()=>({lists:[],total:0}),invites:()=>[]}));

test("candidate metadata starts both authorized reads without waiting and has independent reaction/comment boundaries",async()=>{
  const groupRead=deferred(),itemRead=deferred();provider.configure({group:()=>groupRead.promise,item:()=>itemRead.promise});
  const pending=content(Detail);await setImmediate();
  assert.deepEqual(provider.calls.map(call=>call[0]),["auth","group","item"]);
  assert.deepEqual(provider.calls[2],["item",groupId,itemId]);
  groupRead.resolve(group);itemRead.resolve(item);const body=await pending;
  assert.match(text(body),/テスト候補/);assert.match(text(body),/メモ/);
  const boundaries=walk(body,node=>node.type===Suspense && node.props.children.type?.name!=="ItemPlaceSection");
  assert.equal(walk(body,node=>node.type===Suspense && node.props.children.type?.name==="ItemPlaceSection").length,1);
  assert.equal(boundaries.length,4);assert.match(text(boundaries[0].props.fallback),/反応/);assert.match(text(boundaries[1].props.fallback),/リスト/);assert.match(text(boundaries[2].props.fallback),/コメント/);assert.match(text(boundaries[3].props.fallback),/訪問/);
  assert.equal(boundaries[0].props.children.type,ItemReactionSection);assert.equal(boundaries[1].props.children.type,ItemLists);
  assert.deepEqual(provider.calls.map(call=>call[0]),["auth","group","item"]);
});
test("list reads start together and keep the selected group and filters",async()=>{
  const groupRead=deferred(),itemsRead=deferred();provider.configure({group:()=>groupRead.promise,items:()=>itemsRead.promise});
  const input=props();input.searchParams=Promise.resolve({q:"候補",kind:"spot",reaction:"unreacted",page:"2"});
  const pending=content(List,input);await setImmediate();
  assert.deepEqual(provider.calls.map(call=>call[0]),["auth","group","items"]);
  assert.deepEqual(provider.calls[2],["items",groupId,2,"候補",{kind:"spot",reaction:"unreacted"}]);
  groupRead.resolve(group);itemsRead.resolve({items:[],total:0});assert.match(text(await pending),/みんなの行きたい/);
});
test("group metadata and rename form can render before invitation data is fetched",async()=>{
  const body=await content(Group);assert.match(text(body),/テストグループ/);
  const boundaries=walk(body,node=>node.type===Suspense);assert.equal(boundaries.length,3);assert.match(text(boundaries[0].props.fallback),/退出/);assert.match(text(boundaries[1].props.fallback),/メンバー/);assert.match(text(boundaries[2].props.fallback),/招待/);
  assert.deepEqual(provider.calls.map(call=>call[0]),["auth","group"]);
});
test("signed-out renders redirect before any data read",async()=>{
  for(const Page of [Detail,List,Group]){
    provider.configure({signedOut:true});await assert.rejects(content(Page),error=>error.location.startsWith("/auth/login?next="));assert.deepEqual(provider.calls,[["auth"]]);
  }
});
test("non-member candidate reads fail closed and do not start auxiliary sections",async()=>{
  provider.configure({group:()=>null,item:()=>null});await assert.rejects(content(Detail),error=>error.navigation==="not-found");assert.deepEqual(provider.calls.map(call=>call[0]),["auth","group","item"]);
});
test("reaction failures stay in their section, with no raw provider detail or false zero count",async()=>{
  provider.configure({reactions:()=>{throw new Error("private provider detail");}});
  const section=await ItemReactionSection({client:{},groupId,itemId});assert.match(text(section),/反応を読み込めませんでした/);assert.ok(!text(section).includes("private"));assert.ok(!text(section).includes("0人"));
});
test("comment and list pages keep each other's URL state",async()=>{
  const input=props();input.searchParams=Promise.resolve({q:"Cafe",list:"30000000-0000-4000-8000-000000000001",commentsPage:"2",listsPage:"3",listsQ:"旅"});
  const body=await content(Detail,input),boundaries=walk(body,node=>node.type===Suspense && node.props.children.type?.name!=="ItemPlaceSection");
  assert.equal(boundaries.length,4);
  const listParams=new URL(boundaries[1].props.children.props.detailHref,"https://example.invalid").searchParams;
  const commentParams=new URL(boundaries[2].props.children.props.detailHref,"https://example.invalid").searchParams;
  for(const params of [listParams,commentParams])assert.deepEqual([params.get("q"),params.get("list"),params.get("commentsPage"),params.get("listsPage"),params.get("listsQ")],["Cafe","30000000-0000-4000-8000-000000000001","2","3","旅"]);
});

test("a candidate opened from all groups returns to the original search and preserves that origin in auxiliary pages",async()=>{
  const input=props();input.searchParams=Promise.resolve({origin:"all",q:"カフェ.*",kind:"spot",page:"2",commentsPage:"2"});
  const body=await content(Detail,input);
  const back=walk(body,node=>typeof node.props?.href==="string"&&node.props.href.startsWith("/app/items?"))[0];
  const query=new URL(back.props.href,"https://example.invalid").searchParams;
  assert.deepEqual([query.get("q"),query.get("kind"),query.get("page")],["カフェ.*","spot","2"]);
  for(const boundary of walk(body,node=>node.type===Suspense).filter(node=>node.props.children.props.detailHref))assert.equal(new URL(boundary.props.children.props.detailHref,"https://example.invalid").searchParams.get("origin"),"all");
});


test('comments appear in chronological bubbles with own messages on the right and member messages on the left',async()=>{
  const newer={id:'new',body:'自分のひとこと',created_at:'2026-10-18T02:00:00Z',is_mine:true,display_name:'はる',revision:1,can_delete:true};
  const older={...newer,id:'old',body:'相手のひとこと',created_at:'2026-10-18T01:00:00Z',is_mine:false,display_name:'あおい',can_delete:false};
  provider.configure({comments:()=>({comments:[newer,older],total:2})});
  const body=await ItemComments({client:{},groupId,itemId,page:1,detailHref:'/app/groups/'+groupId+'/items/'+itemId}),rows=walk(body,n=>n.props?.className==='kk-chat-row');
  assert.deepEqual(rows.map(n=>n.props['data-mine']),[false,true]);assert.match(text(rows[0]),/相手のひとこと/);assert.match(text(rows[1]),/自分のひとこと/);assert.match(text(body),/ここで話そう/);
});
test('list classification is visible without opening a disclosure and named list buttons keep browse routes',async()=>{
  const body=await content(Detail);const details=walk(body,n=>n.type==='details');assert.ok(!details.some(n=>walk(n,x=>x.type===ItemLists).length));
  const listId='30000000-0000-4000-8000-000000000001';provider.configure({lists:()=>({lists:[{id:listId,name:'週末',is_selected:true}],total:1})});
  const panel=await ItemLists({client:{},groupId,itemId,page:1,query:'',detailHref:'/app/groups/'+groupId+'/items/'+itemId});
  assert.equal(panel.props.className.includes('kk-list-feature'),true);const toggle=walk(panel,n=>n.props?.listId===listId)[0];assert.equal(toggle.props.label,'週末');assert.equal(toggle.props.selected,true);assert.ok(walk(panel,n=>n.props?.href==='/app/groups/'+groupId+'/items?list='+listId).length);
});

test('spot detail offers a name search without pretending the title is a verified place; activities do not',async()=>{
  const spot=await content(Detail);
  const links=walk(spot,node=>node.type==='a'&&node.props.href?.startsWith('https://www.google.com/maps/'));
  assert.equal(links.length,1);const url=new URL(links[0].props.href);assert.equal(url.searchParams.get('query'),item.title);assert.equal(url.searchParams.has('query_place_id'),false);assert.equal(links[0].props.rel,'noopener noreferrer');assert.match(text(spot),/この名前で検索/);
  provider.configure({group:()=>group,item:()=>({...item,kind:'activity'})});const activity=await content(Detail);assert.equal(walk(activity,node=>node.type==='a'&&node.props.href?.startsWith('https://www.google.com/maps/')).length,0);
});
