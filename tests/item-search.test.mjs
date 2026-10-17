import assert from "node:assert/strict";
import {test} from "node:test";
import {itemSearchQuery,itemFilters,validItemSearch,literalTitlePattern,titleSearchFilter,sharedItemListHref,sharedItemDetailHref,sharedItemCommentsHref} from "../lib/items/search.ts";

test("search trims blank input and accepts only one textual query",()=>{
  assert.equal(itemSearchQuery("　カフェ \n"),"カフェ");
  for(const value of [null,undefined,["first","second"],{}])assert.equal(itemSearchQuery(value),"");
});

test("the bounded search accepts 100 Unicode characters and rejects longer input",()=>{
  assert.equal(validItemSearch("😀".repeat(100)),true);assert.equal(validItemSearch("😀".repeat(101)),false);
});

test("search metacharacters are literal rather than executable patterns",()=>{
  const value=".*+?^${}()|[]\\%_";
  const regex=new RegExp(literalTitlePattern(value),"i");
  assert.ok(regex.test(`before${value}after`));assert.ok(!regex.test("unrelated"));
});

test("individual REST filters carry the regex unchanged without IN/OR quoting",()=>{
  for(const query of ['"quoted", name:(x).*','back\\slash','%_*',"カフェ"]){
    const filter=titleSearchFilter(query);
    assert.equal(filter,literalTitlePattern(query));
    assert.ok(new RegExp(filter,"i").test(`before${query}after`));
  }
  assert.equal(titleSearchFilter("フェ"),"フェ");
});

test("detail and pagination links keep the same literal search without query or fragment injection",()=>{
  const groupId="10000000-0000-4000-8000-000000000001",itemId="20000000-0000-4000-8000-000000000001",query="カフェ &page=9#fragment";
  const detail=new URL(sharedItemDetailHref(groupId,itemId,query,2),"https://example.test");
  const list=new URL(sharedItemListHref(groupId,query,2),"https://example.test");
  assert.equal(detail.search,list.search);assert.equal(detail.searchParams.get("q"),query);assert.equal(detail.searchParams.get("page"),"2");assert.equal(detail.hash,"");
  assert.equal(sharedItemListHref(groupId),`/app/groups/${groupId}/items`);
  assert.equal(new URL(sharedItemListHref(groupId,query),list).searchParams.get("page"),null);
});

test("kind and own-reaction filters reject arbitrary inputs and survive detail/pagination links",()=>{
  assert.deepEqual(itemFilters({kind:["spot"],reaction:"other"}),{kind:undefined,reaction:undefined});
  for(const reaction of ["want_to_go","not_now","unreacted"]){
    const filters=itemFilters({kind:"activity",reaction});
    const detail=new URL(sharedItemDetailHref("group","item","カフェ",2,filters),"https://example.test");
    const list=new URL(sharedItemListHref("group","カフェ",2,filters),detail);
    assert.equal(detail.search,list.search);assert.equal(detail.searchParams.get("kind"),"activity");assert.equal(detail.searchParams.get("reaction"),reaction);
    assert.equal(new URL(sharedItemListHref("group","カフェ",1,filters),detail).searchParams.get("page"),null);
  }
});

test("comment pagination keeps candidate filters and page while returning to latest removes only comment paging",()=>{
  const detail=sharedItemDetailHref("group","item","海 & #",3,{kind:"spot",reaction:"want_to_go"});
  const older=sharedItemCommentsHref(detail,2),latest=sharedItemCommentsHref(older,1);
  const url=new URL(older,"https://example.test");
  assert.equal(url.searchParams.get("commentsPage"),"2");assert.equal(url.searchParams.get("page"),"3");assert.equal(url.searchParams.get("q"),"海 & #");
  assert.equal(latest,detail);assert.equal(url.hash,"");
});
