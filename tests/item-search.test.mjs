import assert from "node:assert/strict";
import {test} from "node:test";
import {itemSearchQuery,validItemSearch,literalTitlePattern,titleSearchFilter,sharedItemListHref,sharedItemDetailHref} from "../lib/items/search.ts";

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

test("REST filter quoting preserves leading quotes, backslashes and reserved punctuation",()=>{
  for(const query of ['"quoted", name:(x).*','back\\slash','%_*',"カフェ"]){
    const filter=titleSearchFilter(query);
    assert.ok(filter.startsWith('"')&&filter.endsWith('"'));
    assert.equal(filter.slice(1,-1).replace(/\\(["\\])/g,"$1"),literalTitlePattern(query));
  }
});

test("detail and pagination links keep the same literal search without query or fragment injection",()=>{
  const groupId="10000000-0000-4000-8000-000000000001",itemId="20000000-0000-4000-8000-000000000001",query="カフェ &page=9#fragment";
  const detail=new URL(sharedItemDetailHref(groupId,itemId,query,2),"https://example.test");
  const list=new URL(sharedItemListHref(groupId,query,2),"https://example.test");
  assert.equal(detail.search,list.search);assert.equal(detail.searchParams.get("q"),query);assert.equal(detail.searchParams.get("page"),"2");assert.equal(detail.hash,"");
  assert.equal(sharedItemListHref(groupId),`/app/groups/${groupId}/items`);
  assert.equal(new URL(sharedItemListHref(groupId,query),list).searchParams.get("page"),null);
});
