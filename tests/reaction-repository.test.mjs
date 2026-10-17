import assert from "node:assert/strict";
import {test} from "node:test";
import {getReactions} from "../lib/items/reactions.ts";

test("only counts and the requesting member's reaction cross the UI boundary",async()=>{
  const calls=[];
  const client={rpc:async(name,input)=>{
    calls.push({name,input});
    return {data:[{want_count:2,not_now_count:1,my_reaction:"want_to_go",unexpected_user_id:"private-user"}],error:null};
  }};
  assert.deepEqual(await getReactions(client,"selected-group","selected-item"),{want_count:2,not_now_count:1,my_reaction:"want_to_go"});
  assert.deepEqual(calls,[{name:"get_item_reactions",input:{p_group_id:"selected-group",p_item_id:"selected-item"}}]);
});

test("missing RPCs and permission errors never disclose provider messages or masquerade as zero counts",async()=>{
  for(const code of ["PGRST202","42501","XX000"]){
    await assert.rejects(getReactions({rpc:async()=>({data:null,error:{code,message:"private-provider"}})},"group","item"),error=>!error.message.includes("private"));
  }
  await assert.rejects(getReactions({rpc:async()=>({data:[],error:null})},"group","item"));
});

test("invalid totals or reaction values fail instead of showing corrupt saved state",async()=>{
  for(const row of [{want_count:-1,not_now_count:0,my_reaction:null},{want_count:0,not_now_count:0,my_reaction:"unexpected"},{want_count:0.5,not_now_count:0,my_reaction:null}]){
    await assert.rejects(getReactions({rpc:async()=>({data:[row],error:null})},"group","item"));
  }
});
