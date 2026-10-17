import assert from "node:assert/strict";
import { test } from "node:test";
import { getItem, listItems } from "../lib/items/repository.ts";

const groupA="10000000-0000-4000-8000-000000000001", groupB="10000000-0000-4000-8000-000000000002";
const rows=Array.from({length:23},(_,index)=>({id:`candidate-${index}`,group_id:groupA,title:`候補${index}`,kind:"spot",memo:"",created_at:`2026-10-17T00:00:${String(index).padStart(2,"0")}Z`}))
  .concat({id:"other-group-candidate",group_id:groupB,title:"別グループ",kind:"activity",memo:"",created_at:"2026-10-17T00:01:00Z"});

// Both groups are visible to this simulated member. RLS alone cannot prevent
// mixing their data; the repository must also scope reads to the selected group.
function client(error=null){return {from(table){
  assert.equal(table,"items");
  let filtered=[...rows], orders=[], start=0, end=Infinity;
  const result=()=>({data:filtered.slice(start,end+1),count:filtered.length,error});
  const query={
    select(){return query;},
    eq(key,value){filtered=filtered.filter(row=>row[key]===value);return query;},
    order(key,{ascending}){orders.push({key,ascending});return query;},
    range(first,last){
      start=first;end=last;
      filtered.sort((a,b)=>{for(const {key,ascending} of orders){const comparison=a[key].localeCompare(b[key]);if(comparison)return ascending?comparison:-comparison;}return 0;});
      return Promise.resolve(result());
    },
    maybeSingle(){return Promise.resolve({data:filtered[0]??null,error});},
  };
  return query;
}};}

test("selected-group pagination returns every candidate once without another group's data",async()=>{
  const first=await listItems(client(),groupA,1), second=await listItems(client(),groupA,2);
  assert.equal(first.total,23);assert.equal(second.total,23);
  assert.equal(first.items.length,20);assert.equal(second.items.length,3);
  const combined=[...first.items,...second.items];
  assert.ok(combined.every(row=>row.group_id===groupA));
  assert.equal(new Set(combined.map(row=>row.id)).size,23);
  assert.equal(first.items[0].title,"候補22");assert.equal(second.items.at(-1).title,"候補0");
});

test("an item from another joined group cannot appear under the selected group's detail URL",async()=>{
  assert.equal(await getItem(client(),groupA,"other-group-candidate"),null);
  assert.equal((await getItem(client(),groupB,"other-group-candidate")).title,"別グループ");
  assert.equal(await getItem(client(),groupA,"missing"),null);
});

test("an unavailable store or failed query is an error, never a misleading empty list",async()=>{
  await assert.rejects(listItems(client({code:"PGRST205",message:"private-schema"}),groupA,1),error=>error.message.includes("準備中")&&!error.message.includes("private"));
  await assert.rejects(getItem(client({code:"42501",message:"private-policy"}),groupA,"candidate-0"),error=>!error.message.includes("private"));
});
