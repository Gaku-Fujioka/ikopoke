import assert from 'node:assert/strict';import {test} from 'node:test';import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return {url:new URL(`../${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const {parseTrip,shiftDay,dateDistance}=await import('../lib/outings/trips.ts');
const group='10000000-0000-4000-8000-000000000001',plan='30000000-0000-4000-8000-000000000001',actor='00000000-0000-4000-8000-000000000001',item='20000000-0000-4000-8000-000000000001';
const slots=[1,2].map(n=>({id:`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`,item_id:item,planned_time:'10:15',period:'morning'}));
function form(change={}){const f=new FormData();for(const [k,v]of Object.entries({groupId:group,outingId:plan,expectedRevision:'0',title:' 旅行 ',start:'2028-02-28',end:'2028-02-29',memo:'',days:JSON.stringify([{mode:'exact',participants:[actor],items:slots},{mode:'order',participants:[actor],items:[]}]),participants:JSON.stringify([actor]),removedIds:'[]',...change}))f.set(k,v);return f;}
test('travel date arithmetic preserves calendar dates at leap days and bounds',()=>{assert.equal(shiftDay('2028-02-28',2),'2028-03-01');assert.equal(dateDistance('2028-02-28','2028-03-01'),2);assert.equal(shiftDay('9999-12-31',1),'');assert.equal(shiftDay('0001-01-01',-1),'');});
test('trip input allows repeated candidates but uses distinct stop IDs and keeps hidden values',()=>{const input=parseTrip(form());assert.equal(input.title,'旅行');assert.equal(input.days[0].items.length,2);assert.equal(input.days[0].items[0].period,'morning');assert.equal(input.days[0].items[1].item_id,item);});
test('invalid dates, mismatched day count, duplicate slots, blank names and missing participants fail before writes',()=>{
  for(const change of [{start:'2027-02-29'},{start:'0000-01-01'},{end:'2028-02-27'},{end:'2028-03-01'},{title:'　'},{participants:'[]'},{removedIds:'[null]'}])assert.throws(()=>parseTrip(form(change)));
  const duplicate=JSON.stringify([{mode:'order',participants:[actor],items:[slots[0],slots[0]]},{mode:'order',participants:[actor],items:[]}]);assert.throws(()=>parseTrip(form({days:duplicate})));
});
