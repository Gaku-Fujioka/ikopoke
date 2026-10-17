import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

const { PGlite } = await import(process.env.KOKOIKO_PGLITE_MODULE_URL ?? "@electric-sql/pglite");
let db;
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const outsider = "00000000-0000-4000-8000-000000000003";
const group = "10000000-0000-4000-8000-000000000001";
const otherGroup = "10000000-0000-4000-8000-000000000002";
const fails = (promise, code) => assert.rejects(promise, error => error.code === code);

async function asUser(id, work, role = "authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await work(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}

before(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon, authenticated;`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261017091513_create_groups.sql", import.meta.url), "utf8"));
  const migrations = await import("node:fs/promises").then(fs => fs.readdir(new URL("../supabase/migrations/", import.meta.url)));
  const profileMigration = migrations.find(name => name.endsWith("_account_display_names.sql"));
  assert.ok(profileMigration);
  await db.exec(await readFile(new URL(`../supabase/migrations/${profileMigration}`, import.meta.url), "utf8"));
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4),($5,$6)", [alice, {display_name:"  アリス  "}, bob, {}, outsider, {display_name:"第三者"}]);
  await asUser(alice, () => db.query("select public.create_group('A',$1)", [group]));
  await asUser(outsider, () => db.query("select public.create_group('B',$1)", [otherGroup]));
  await db.query("insert into public.group_members(group_id,user_id) values($1,$2)", [group,bob]);
});
after(async () => db?.close());

test("signup metadata creates a trimmed display name, while missing metadata allows signup", async () => {
  assert.deepEqual((await db.query("select user_id,display_name from public.profiles order by user_id")).rows, [
    {user_id:alice,display_name:"アリス"}, {user_id:outsider,display_name:"第三者"}
  ]);
});

test("existing users can set only their own name and RLS hides other profiles", async () => {
  await asUser(bob, async () => {
    assert.deepEqual((await db.query("select display_name from public.profiles")).rows, []);
    await db.query("select public.set_my_display_name('  ボブ  ')");
    assert.deepEqual((await db.query("select display_name from public.profiles")).rows, [{display_name:"ボブ"}]);
    await fails(db.query("select public.set_my_display_name('　')"),"22023");
    assert.equal((await db.query("update public.profiles set display_name='なりすまし' where user_id=$1",[alice])).affectedRows, 0);
    await fails(db.query("select updated_at from public.profiles"),"42501");
  });
  await asUser(null, () => fails(db.query("select public.set_my_display_name('x')"),"42501"),"anon");
});

test("members see names only within their own group, including names added after joining", async () => {
  assert.deepEqual((await asUser(alice, () => db.query("select * from public.get_group_members($1)",[group]))).rows, [
    {user_id:alice,display_name:"アリス"}, {user_id:bob,display_name:"ボブ"}
  ]);
  await asUser(outsider, () => fails(db.query("select * from public.get_group_members($1)",[group]),"42501"));
  await asUser(alice, () => fails(db.query("select * from public.get_group_members($1)",[otherGroup]),"42501"));
  await asUser(null, () => fails(db.query("select * from public.get_group_members($1)",[group]),"42501"),"anon");
});
