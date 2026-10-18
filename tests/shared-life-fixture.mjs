import {readFile,readdir} from 'node:fs/promises';
import {createStorageFixture} from './storage-fixture.mjs';
const {PGlite}=await import(process.env.KOKOIKO_PGLITE_MODULE_URL??'@electric-sql/pglite');
export const ids={alice:'00000000-0000-4000-8000-000000000001',bob:'00000000-0000-4000-8000-000000000002',outsider:'00000000-0000-4000-8000-000000000003',group:'10000000-0000-4000-8000-000000000001',otherGroup:'10000000-0000-4000-8000-000000000002',cafe:'20000000-0000-4000-8000-000000000001',park:'20000000-0000-4000-8000-000000000002',other:'20000000-0000-4000-8000-000000000003',plan:'30000000-0000-4000-8000-000000000001',visit:'40000000-0000-4000-8000-000000000001',photo:'50000000-0000-4000-8000-000000000001',photo2:'50000000-0000-4000-8000-000000000002',comment:'60000000-0000-4000-8000-000000000001'};
export async function fixture(){
  const db=await PGlite.create();
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;insert into auth.users values('${ids.alice}'),('${ids.bob}'),('${ids.outsider}');`);
  await createStorageFixture(db);
  for(const name of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
  async function as(user,work,role='authenticated'){
    await db.exec(`set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);
    try{return await work();}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}
  }
  const {alice,bob,outsider,group,otherGroup,cafe,park,other,plan}=ids;
  await as(alice,async()=>{await db.query("select public.set_my_display_name('あおい')");await db.query("select public.create_group('みんな',$1)",[group]);await db.query("select public.create_item($1,'カフェ.*','spot','メモ',$2)",[group,cafe]);await db.query("select public.create_item($1,'公園','spot','',$2)",[group,park]);});
  await db.query('insert into public.group_members(group_id,user_id) values($1,$2)',[group,bob]);await as(bob,()=>db.query("select public.set_my_display_name('はる')"));
  await as(outsider,async()=>{await db.query("select public.create_group('別',$1)",[otherGroup]);await db.query("select public.create_item($1,'別の候補','spot','',$2)",[otherGroup,other]);});
  await as(alice,()=>db.query("select public.save_outing($1,$2,0,'計画','2026-10-18','order','',$3,$4)",[group,plan,JSON.stringify([{item_id:cafe}]),[alice,bob]]));
  return {db,as};
}
