import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";
import { Suspense } from "react";
import ts from "typescript";
import { calendarCells, calendarDateLabel, calendarHref, calendarMonth, isCalendarDate, japanCalendarToday, selectedCalendarDay, shiftCalendarMonth } from "../lib/outings/calendar.ts";

const moduleURL = source => `data:text/javascript,${encodeURIComponent(source)}`;
const providerURL = moduleURL(`
export const calls=[];let plan={};export function configure(value){plan=value;calls.length=0;}
export class OutingStoreError extends Error{}
export async function createClient(){return {auth:{getClaims:async()=>{calls.push('auth');return {data:plan.signedOut?null:{claims:{sub:'synthetic-user'}},error:null};}}};}
export async function getGroup(client,id){calls.push(['group',id]);return plan.group;}
export async function listOutings(client,id){calls.push(['outings',id]);if(plan.fail)throw new Error('private provider detail');return plan.outings;}
export async function listCandidateOptions(){return [];}
export async function getGroupMembers(){return [];}
`);
const leafURL = moduleURL("export default function Link(){return null;}export function AuthSetupNotice(){return null;}export function OutingForm(){return null;}");
const navigationURL = moduleURL("export function notFound(){const e=new Error('not found');e.navigation='not-found';throw e;}export function redirect(path){const e=new Error('redirect');e.location=path;throw e;}");
registerHooks({
  resolve(specifier,context,next) {
    if(specifier === "@/lib/utils")return {url:moduleURL("export const hasEnvVars=true;"),shortCircuit:true};
    if(["@/lib/supabase/server","@/lib/groups/repository","@/lib/outings/repository","@/lib/profiles/repository"].includes(specifier))return {url:providerURL,shortCircuit:true};
    if(specifier === "next/navigation")return {url:navigationURL,shortCircuit:true};
    if(["next/link","@/components/auth-setup-notice","@/components/outings/outing-form"].includes(specifier))return {url:leafURL,shortCircuit:true};
    if(specifier.startsWith("@/"))return {url:new URL(`../${specifier.slice(2)}${specifier.startsWith("@/components/")?".tsx":".ts"}`,import.meta.url).href,shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next) {
    if(url.endsWith(".tsx"))return {format:"module",source:ts.transpileModule(readFileSync(fileURLToPath(url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const { OutingCalendar } = await import("../components/outings/outing-calendar.tsx");
const { default: CalendarPage } = await import("../app/app/groups/[groupId]/outings/calendar/page.tsx");
const { default: NewPage } = await import("../app/app/groups/[groupId]/outings/new/page.tsx");
const provider = await import(providerURL);
const groupId="10000000-0000-4000-8000-000000000001", itemId="20000000-0000-4000-8000-000000000001";
const outing=(id,date,title)=>({id,group_id:groupId,title,outing_date:date,mode:"order",memo:"",revision:1});
const outings=[outing("a","2028-02-29","カフェ"),outing("b","2028-02-29","公園"),outing("c","2028-03-01","来月の予定")];
const props=(search={})=>({params:Promise.resolve({groupId}),searchParams:Promise.resolve(search)});
function walk(node,predicate){if(!node||typeof node!=="object")return [];const children=Array.isArray(node)?node:[node.props?.children];return [...(!Array.isArray(node)&&predicate(node)?[node]:[]),...children.flatMap(child=>walk(child,predicate))];}
function text(node){if(typeof node==="string"||typeof node==="number")return String(node);if(!node||typeof node!=="object")return "";return (Array.isArray(node)?node:[node.props?.children]).map(text).join(" ");}
function content(Page,input){const tree=Page(input);const boundary=walk(tree,node=>node.type===Suspense)[0];return boundary.props.children.type(boundary.props.children.props);}
beforeEach(()=>provider.configure({group:{id:groupId,name:"テストグループ"},outings}));

test("calendar arithmetic keeps leap days and month/year boundaries",()=>{
  assert.equal(isCalendarDate("2028-02-29"),true);
  for(const value of ["2027-02-29","2028-02-30","0000-01-01","2028-13-01",["2028-02-29"]])assert.equal(isCalendarDate(value),false);
  const leap=calendarCells("2028-02");assert.equal(leap.filter(Boolean).length,29);assert.equal(leap[2],"2028-02-01");assert.ok(leap.includes("2028-02-29"));assert.equal(leap.length%7,0);
  assert.equal(calendarCells("2026-02").length,28);
  assert.equal(shiftCalendarMonth("2028-01",-1),"2027-12");assert.equal(shiftCalendarMonth("2028-12",1),"2029-01");
  assert.equal(shiftCalendarMonth("0001-01",-1),null);assert.equal(shiftCalendarMonth("9999-12",1),null);
});
test("Japan's today and URL selection never shift a stored plan date",()=>{
  assert.equal(japanCalendarToday(new Date("2026-10-17T14:59:59Z")),"2026-10-17");
  assert.equal(japanCalendarToday(new Date("2026-10-17T15:00:00Z")),"2026-10-18");
  assert.equal(calendarMonth(["2028-02"],"2026-10-18"),"2026-10");
  assert.equal(selectedCalendarDay("2028-03-01","2028-02"),null);
  assert.equal(selectedCalendarDay("2028-02-29","2028-02"),"2028-02-29");
  assert.equal(calendarDateLabel("2028-02-29"),"2028年2月29日");
  assert.equal(new URL(calendarHref(groupId,"2028-02","2028-02-29"),"https://example.invalid").searchParams.get("day"),"2028-02-29");
});
test("selected-day view shows all plans on that day and a date-prefilled create link",()=>{
  const body=OutingCalendar({groupId,outings,month:"2028-02",today:"2028-02-29",selectedDay:"2028-02-29"});
  assert.match(text(body),/カフェ/);assert.match(text(body),/公園/);assert.ok(!text(body).includes("来月の予定"));
  const links=walk(body,node=>typeof node.props?.href==="string");
  assert.ok(links.some(node=>node.props.href===`/app/groups/${groupId}/outings/new?date=2028-02-29`));
  assert.ok(links.some(node=>node.props["aria-label"]?.includes("計画2件、選択中")&&node.props["aria-current"]==="date"));
  const empty=OutingCalendar({groupId,outings,month:"2028-02",today:"2028-02-29",selectedDay:"2028-02-28"});
  assert.match(text(empty),/この日の 計画はまだありません/);assert.ok(!text(empty).includes("カフェ"));
});
test("calendar requires auth and scopes both reads to the requested group",async()=>{
  const body=await content(CalendarPage,props({month:"2028-02",day:"2028-02-29"}));
  const calendar=walk(body,node=>node.type===OutingCalendar)[0];
  assert.equal(calendar.props.month,"2028-02");assert.equal(calendar.props.selectedDay,"2028-02-29");
  assert.deepEqual(provider.calls,["auth",["group",groupId],["outings",groupId]]);
  provider.configure({signedOut:true});
  await assert.rejects(content(CalendarPage,props({month:"2028-02",day:"2028-02-29"})),error=>{
    const next=new URL(error.location,"https://example.invalid").searchParams.get("next");
    return next===calendarHref(groupId,"2028-02","2028-02-29");
  });
  assert.deepEqual(provider.calls,["auth"]);
});
test("unavailable groups fail closed and load failures are not shown as empty calendars",async()=>{
  provider.configure({group:null,outings:[]});
  await assert.rejects(content(CalendarPage,props()),error=>error.navigation==="not-found");
  provider.configure({group:{id:groupId},fail:true});
  const body=await content(CalendarPage,props());
  assert.match(text(body),/読み込めませんでした/);assert.ok(!text(body).includes("private"));assert.equal(walk(body,node=>node.type===OutingCalendar).length,0);
});
test("valid date and candidate defaults survive login; invalid dates stay unset",async()=>{
  const body=await content(NewPage,props({date:"2028-02-29",item:itemId}));
  const form=walk(body,node=>node.props?.outingId)[0];
  assert.equal(form.props.initialDate,"2028-02-29");assert.equal(form.props.initialItemId,itemId);
  const invalid=await content(NewPage,props({date:"2027-02-29"}));
  assert.equal(walk(invalid,node=>node.props?.outingId)[0].props.initialDate,undefined);
  provider.configure({signedOut:true});
  await assert.rejects(content(NewPage,props({date:"2028-02-29",item:itemId})),error=>{
    const next=new URL(error.location,"https://example.invalid").searchParams.get("next");
    const params=new URL(next,"https://example.invalid").searchParams;
    return params.get("date")==="2028-02-29"&&params.get("item")===itemId;
  });
  assert.deepEqual(provider.calls,["auth"]);
});

test("multi-day trips span month boundaries and cancelled plans stay outside the calendar",()=>{
  const travel={...outings[0],id:'travel',title:'月をまたぐ旅',outing_date:'2028-02-28',end_date:'2028-03-02',cancelled_at:null};
  const cancelled={...travel,id:'cancelled',title:'中止した旅',cancelled_at:'2028-02-01T00:00:00Z'};
  const body=OutingCalendar({groupId,outings:[travel,cancelled],month:'2028-03',today:'2028-03-01',selectedDay:'2028-03-01'});
  assert.match(text(body),/月をまたぐ旅/);assert.ok(!text(body).includes('中止した旅'));assert.ok(walk(body,n=>n.props?.['aria-label']?.includes('2028年3月1日、計画1件')).length);
});
