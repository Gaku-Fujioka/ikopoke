import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOutingInput } from "../lib/outings/validation.ts";

const group="10000000-0000-4000-8000-000000000001", plan="30000000-0000-4000-8000-000000000001";
const cafe="20000000-0000-4000-8000-000000000001", park="20000000-0000-4000-8000-000000000002";
const alice="00000000-0000-4000-8000-000000000001";
function form(overrides={}) {
  const result=new FormData();
  for(const [key,value] of Object.entries({groupId:group,outingId:plan,expectedRevision:"0",title:" 週末 ",date:"2026-10-25",mode:"order",memo:"メモ",items:JSON.stringify([{item_id:cafe,planned_time:"10:30",period:"morning"}]),participants:JSON.stringify([alice]),...overrides}))result.set(key,value);
  return result;
}

test("all three modes preserve their hidden time and period values",()=>{
  for(const mode of ["exact","period","order"]) {
    const result=parseOutingInput(form({mode}));
    assert.equal(result.mode,mode);
    assert.deepEqual(result.items,[{item_id:cafe,planned_time:"10:30",period:"morning"}]);
    assert.equal(result.title,"週末");
  }
});
test("required date and active mode's slot values are validated",()=>{
  assert.throws(()=>parseOutingInput(form({date:"2026-02-30"})),/日付/);
  assert.throws(()=>parseOutingInput(form({date:""})),/日付/);
  assert.throws(()=>parseOutingInput(form({mode:"exact",items:JSON.stringify([{item_id:cafe,planned_time:null,period:"morning"}])})),/時刻/);
  assert.throws(()=>parseOutingInput(form({mode:"period",items:JSON.stringify([{item_id:cafe,planned_time:"10:30",period:null}])})),/時間帯/);
});
test("duplicate candidates or participants and missing selections are rejected",()=>{
  assert.throws(()=>parseOutingInput(form({items:JSON.stringify([{item_id:cafe},{item_id:cafe}])})),/同じ候補/);
  assert.throws(()=>parseOutingInput(form({items:"[]"})),/候補/);
  assert.throws(()=>parseOutingInput(form({participants:JSON.stringify([alice,alice])})),/参加者/);
  assert.throws(()=>parseOutingInput(form({participants:"[]"})),/参加者/);
  const result=parseOutingInput(form({items:JSON.stringify([{item_id:park,planned_time:null,period:null},{item_id:cafe,planned_time:null,period:null}])}));
  assert.deepEqual(result.items.map(item=>item.item_id),[park,cafe]);
});
