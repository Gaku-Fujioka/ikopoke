import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { itemFilters, sharedItemCommentsHref, sharedItemDetailHref, sharedItemListHref, sharedItemListsHref } from "../lib/items/search.ts";

registerHooks({resolve(specifier,context,next){
  if(specifier==="@/lib/items/search")return {url:new URL("../lib/items/search.ts",import.meta.url).href,shortCircuit:true};
  if(specifier==="./validation" && context.parentURL?.endsWith("/lib/lists/repository.ts"))return {url:new URL("../lib/lists/validation.ts",import.meta.url).href,shortCircuit:true};
  if(specifier==="@/lib/groups/validation")return {url:new URL("../lib/groups/validation.ts",import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
const {listItems}=await import("../lib/items/repository.ts");
const {getItemLists}=await import("../lib/lists/repository.ts");
const group="10000000-0000-4000-8000-000000000001",item="20000000-0000-4000-8000-000000000001",list="30000000-0000-4000-8000-000000000001";

test("list filters survive candidate, comment and classification navigation",()=>{
  const filters=itemFilters({kind:"spot",reaction:"unreacted",list});
  const listHref=sharedItemListHref(group,"Cafe 100%_",2,filters);
  const detail=sharedItemDetailHref(group,item,"Cafe 100%_",2,filters);
  assert.equal(new URL(listHref,"https://example.invalid").searchParams.get("list"),list);
  assert.equal(new URL(detail,"https://example.invalid").searchParams.get("q"),"Cafe 100%_");
  const comments=sharedItemCommentsHref(detail,3),classification=sharedItemListsHref(comments,4,"Cafe");
  const params=new URL(classification,"https://example.invalid").searchParams;
  assert.deepEqual([...params.entries()],[...new URL(comments,"https://example.invalid").searchParams.entries(), ["listsPage","4"],["listsQ","Cafe"]]);
  assert.equal(new URL(sharedItemListsHref(classification,1),"https://example.invalid").searchParams.has("listsQ"),false);
  assert.equal(itemFilters({list:"unclassified"}).list,"unclassified");
  assert.equal(itemFilters({list:"invalid"}).list,undefined);
});

test("selected list filtering sends all conditions to one bounded RPC and exposes only candidate fields",async()=>{
  const requests=[];
  const client={rpc:async(name,args)=>{
    requests.push([name,args]);
    return {data:[{items:[{id:item,group_id:group,title:"Cafe",kind:"spot",memo:"memo",created_at:"2026-10-18T00:00:00Z",created_by:"private"}],total_count:1}],error:null};
  }};
  const result=await listItems(client,group,2,"Cafe",{kind:"spot",reaction:"unreacted",list});
  assert.deepEqual(requests,[["get_group_items",{p_group_id:group,p_query:"Cafe",p_kind:"spot",p_reaction:"unreacted",p_list_id:list,p_unclassified:false,p_page:2}]]);
  assert.equal(result.total,1);assert.equal(result.items[0].created_by,undefined);
  await listItems(client,group,1,"",{list:"unclassified"});
  assert.equal(requests[1][1].p_unclassified,true);assert.equal(requests[1][1].p_list_id,null);
});

test("malformed list and candidate RPC responses fail instead of appearing empty or exposing actor IDs",async()=>{
  const client={rpc:async()=>({data:[{lists:[{id:list,name:"Cafe",is_selected:true,created_by:"private"}],total_count:1}],error:null})};
  const saved=await getItemLists(client,group,item,1);
  assert.deepEqual(saved,{lists:[{id:list,name:"Cafe",is_selected:true}],total:1});
  await assert.rejects(getItemLists({rpc:async()=>({data:[{lists:[],total_count:-1}],error:null})},group,item,1));
  await assert.rejects(listItems({rpc:async()=>({data:[{items:[{id:item,group_id:"other"}],total_count:1}],error:null})},group,1,"",{list}));
});
