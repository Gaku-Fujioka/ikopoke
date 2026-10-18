import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return {url:new URL(`../${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const { getActivity, nextOuting, globalItems, globalOutings }=await import('../lib/home/repository.ts');
const group='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const event={event_key:'a'.repeat(32),group_id:group,kind:'want_to_go',subject_id:'20000000-0000-4000-8000-000000000001',title:'カフェ',actor_name:'A',is_mine:false,occurred_at:'2026-10-18T00:00:00.123456Z'};
test('activity requests preserve the cursor precision and project away unexpected identifiers',async()=>{
  const client={async rpc(name,args){assert.equal(name,'get_home_activity');assert.deepEqual(args,{p_group_id:group,p_limit:21,p_before_at:event.occurred_at,p_before_key:event.event_key});return {data:[{...event,user_id:'private-id',email:'private@example.invalid'}],error:null};}};
  const result=await getActivity(client,group,21,{at:event.occurred_at,key:event.event_key});assert.deepEqual(result,[event]);assert.ok(!JSON.stringify(result).includes('private'));
});
test('activity cannot silently become empty or use malformed or cross-group records on failure',async()=>{
  for(const data of [null,[{...event,group_id:other}],[{...event,subject_id:'bad'}],[{...event,kind:'unknown'}],[{...event,occurred_at:'invalid'}]])await assert.rejects(getActivity({rpc:async()=>({data,error:null})},group));
  await assert.rejects(getActivity({rpc:async()=>({data:[],error:{code:'42501',message:'private-detail'}})},null),error=>!error.message.includes('private'));
});

function fixture(table,rows){return {from(name){assert.equal(name,table);let result=[...rows],orders=[],maximum=Infinity;
  const sort=()=>result.sort((a,b)=>{for(const [key,asc] of orders){const n=String(a[key]).localeCompare(String(b[key]));if(n)return asc?n:-n;}return 0;});
  const query={select(){return query;},eq(key,value){result=result.filter(row=>row[key]===value);return query;},is(key){result=result.filter(row=>row[key]===null);return query;},not(key){result=result.filter(row=>row[key]!==null);return query;},gte(key,value){result=result.filter(row=>row[key]>=value);return query;},filter(key,operator,pattern){assert.equal(operator,'imatch');result=result.filter(row=>new RegExp(pattern,'i').test(row[key]));return query;},order(key,options={ascending:true}){orders.push([key,options.ascending]);return query;},limit(n){maximum=n;return query;},maybeSingle(){sort();return Promise.resolve({data:result.slice(0,maximum)[0]??null,error:null});},range(start,end){sort();return Promise.resolve({data:result.slice(start,end+1),count:result.length,error:null});}};return query;
}};}
test('next enjoyment excludes completed and past outings, scopes to a group and breaks date ties',async()=>{
  const rows=[{id:'0',group_id:group,outing_date:'2026-10-18',completed_at:'finished'},{id:'1',group_id:group,outing_date:'2026-10-17',completed_at:null},{id:'3',group_id:group,outing_date:'2026-10-20',completed_at:null},{id:'2',group_id:group,outing_date:'2026-10-20',completed_at:null},{id:'4',group_id:other,outing_date:'2026-10-19',completed_at:null}];
  assert.equal((await nextOuting(fixture('outings',rows),null,'2026-10-18')).id,'4');assert.equal((await nextOuting(fixture('outings',rows),group,'2026-10-18')).id,'2');assert.equal(await nextOuting(fixture('outings',rows),group,'2026-10-21'),null);
});
test('global candidate filters are sent to the membership-bounded browse RPC',async()=>{
  const calls=[];const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:[{items:[],total_count:0}],error:null};}};
  await globalItems(client,2,'.*','spot',{visited:'unvisited',sort:'recommended'});
  assert.deepEqual(calls,[["browse_items",{p_group_id:null,p_query:'.*',p_kind:'spot',p_reaction:null,p_list_id:null,p_unclassified:false,p_archived:false,p_visited:'unvisited',p_priority:null,p_sort:'recommended',p_page:2}]]);
});

test('all-group outing tabs keep finished and active plans separate',async()=>{
  const rows=[{id:'1',outing_date:'2026-10-17',completed_at:null},{id:'2',outing_date:'2026-10-20',completed_at:null},{id:'3',outing_date:'2026-10-19',completed_at:'finished'}];
  assert.deepEqual((await globalOutings(fixture('outings',rows),1,false)).rows.map(row=>row.id),['1','2']);assert.deepEqual((await globalOutings(fixture('outings',rows),1,true)).rows.map(row=>row.id),['3']);
});
