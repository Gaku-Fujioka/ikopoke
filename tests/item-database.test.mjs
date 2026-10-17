import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

const { PGlite } = await import(process.env.KOKOIKO_PGLITE_MODULE_URL ?? "@electric-sql/pglite");
let db;
const alice = "00000000-0000-4000-8000-000000000001", bob = "00000000-0000-4000-8000-000000000002", charlie = "00000000-0000-4000-8000-000000000003";
const groupA = "10000000-0000-4000-8000-000000000001", groupB = "10000000-0000-4000-8000-000000000002";
const itemA = "20000000-0000-4000-8000-000000000001", itemB = "20000000-0000-4000-8000-000000000002";
before(async () => {
  db = await PGlite.create();
  // PostgreSQL policies and functions are real; JWT verification is not simulated.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users(id) values ('${alice}'),('${bob}'),('${charlie}');
  `);
  for (const name of ["20261017091513_create_groups.sql", "20261017094719_create_group_invites.sql", "20261017110000_create_items.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  await asUser(alice, () => db.query("select public.create_group('A',$1)", [groupA]));
  await asUser(bob, () => db.query("select public.create_group('B',$1)", [groupB]));
});
after(async () => { await db?.close(); });
async function asUser(userId, work, role = "authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId ?? ""]);
  try { return await work(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','','false')"); }
}
const fails = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const create = (group = groupA, title = "カフェ", kind = "spot", memo = "", id = itemA) => db.query("select public.create_item($1,$2,$3,$4,$5) as id", [group,title,kind,memo,id]);

test("anonymous reads and RPC calls are denied", async () => {
  await asUser(null, async () => {
    await fails(db.query("select id from public.items"), "42501");
    await fails(create(), "42501");
  }, "anon");
});

test("missing identity and non-member group IDs cannot create candidates", async () => {
  await asUser(null, () => fails(create(), "28000"));
  await asUser(charlie, () => fails(create(), "42501"));
  await asUser(alice, () => fails(create(groupB), "42501"));
  await asUser(alice, () => fails(create(null), "42501"));
});

test("creation stores trimmed input, group and verified actor", async () => {
  await asUser(alice, () => create(groupA, "　カフェ \n", "spot", "\t海を見たい　"));
  assert.deepEqual((await db.query("select id,group_id,title,kind,memo,created_by from public.items where id=$1", [itemA])).rows,
    [{id:itemA, group_id:groupA, title:"カフェ", kind:"spot", memo:"海を見たい", created_by:alice}]);
  await asUser(bob, () => create(groupB, "散歩", "activity", null, itemB));
});

test("RLS hides other groups including direct known item and group IDs", async () => {
  await asUser(alice, async () => {
    assert.deepEqual((await db.query("select id from public.items")).rows, [{id:itemA}]);
    assert.deepEqual((await db.query("select title from public.items where id=$1", [itemB])).rows, []);
    assert.deepEqual((await db.query("select id from public.items where group_id=$1", [groupB])).rows, []);
  });
  await asUser(charlie, () => db.query("select id from public.items").then(({rows}) => assert.deepEqual(rows, [])));
});

test("same request and normalized content are idempotent without duplicate rows", async () => {
  for (let n = 0; n < 2; n++) await asUser(alice, () => create(groupA, "カフェ", "spot", "海を見たい"));
  assert.equal((await db.query("select count(*)::int as n from public.items where id=$1", [itemA])).rows[0].n, 1);
});

test("reusing a request with changed content or another actor/group never overwrites", async () => {
  await asUser(alice, () => fails(create(groupA, "変更", "spot", "海を見たい"), "23505"));
  await asUser(alice, () => fails(create(groupA, "カフェ", "activity", "海を見たい"), "23505"));
  await asUser(alice, () => fails(create(groupA, "カフェ", "spot", "変更"), "23505"));
  await asUser(bob, () => fails(create(groupB, "カフェ", "spot", "海を見たい"), "23505"));
  assert.equal((await db.query("select title from public.items where id=$1", [itemA])).rows[0].title, "カフェ");
});

test("even members cannot bypass RPC with direct insert, update or delete", async () => {
  await asUser(alice, async () => {
    await fails(db.query("insert into public.items(id,group_id,title,kind,created_by) values(gen_random_uuid(),$1,'偽装','spot',$2)", [groupA,bob]), "42501");
    await fails(db.query("update public.items set group_id=$1 where id=$2", [groupB,itemA]), "42501");
    await fails(db.query("delete from public.items where id=$1", [itemA]), "42501");
  });
});

test("RPC rejects blank, overlong, invalid-kind and null request input atomically", async () => {
  const id = "20000000-0000-4000-8000-000000000003";
  const invalid = [
    [null,"spot",""], ["","spot",""], [" \t\n　\uFEFF","spot",""], ["x".repeat(101),"spot",""],
    ["Valid",null,""], ["Valid","other",""], ["Valid","spot","x".repeat(2001)],
  ];
  for (const [title,kind,memo] of invalid) await asUser(alice, () => fails(create(groupA,title,kind,memo,id), "22023"));
  await asUser(alice, () => fails(create(groupA,"Valid","spot","",null), "22023"));
  assert.deepEqual((await db.query("select id from public.items where id=$1", [id])).rows, []);
});

test("database counts emoji as characters and accepts minimal activity input", async () => {
  const id = "20000000-0000-4000-8000-000000000004";
  await asUser(alice, () => create(groupA,"😀".repeat(100),"activity","🌸".repeat(2000),id));
  const row = (await db.query("select char_length(title) as title, char_length(memo) as memo from public.items where id=$1", [id])).rows[0];
  assert.deepEqual(row, {title:100,memo:2000});
  await asUser(alice, () => fails(create(groupA,"😀".repeat(101),"activity","",id), "22023"));
});

test("an invited member can read existing candidates and create their own", async () => {
  const token = "a".repeat(64), hash = createHash("sha256").update(token).digest("hex");
  await asUser(alice, () => db.query("select public.create_group_invite($1,$2)", [groupA,hash]));
  await asUser(charlie, () => db.query("select public.accept_group_invite($1,$2)", [token,groupA]));
  await asUser(charlie, async () => {
    assert.equal((await db.query("select title from public.items where id=$1", [itemA])).rows[0].title, "カフェ");
    await create(groupA,"名前だけの候補","activity","","20000000-0000-4000-8000-000000000005");
    await fails(create(groupA,"カフェ","spot","海を見たい",itemA), "23505");
  });
  assert.equal((await db.query("select created_by from public.items where title='名前だけの候補'")).rows[0].created_by, charlie);
});

test("membership removal revokes reads and even retries of previously saved input", async () => {
  // Administrative fixture only: no member-removal API is exposed by the app.
  await db.query("delete from public.group_members where group_id=$1 and user_id=$2", [groupA,charlie]);
  await asUser(charlie, async () => {
    assert.deepEqual((await db.query("select id from public.items")).rows, []);
    await fails(create(groupA,"名前だけの候補","activity","","20000000-0000-4000-8000-000000000005"), "42501");
  });
});
