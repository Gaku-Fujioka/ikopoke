import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

// CI uses the locked dev dependency. An optional file URL allows local runs
// without replacing an existing pnpm-managed node_modules installation.
const { PGlite } = await import(process.env.KOKOIKO_PGLITE_MODULE_URL ?? "@electric-sql/pglite");
let db;
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const charlie = "00000000-0000-4000-8000-000000000003";
const groupA = "10000000-0000-4000-8000-000000000001";
const groupB = "10000000-0000-4000-8000-000000000002";

before(async () => {
  db = await PGlite.create();
  // A minimal Supabase Auth boundary, with actual PostgreSQL roles and RLS.
  // This verifies DB policies; it does not simulate Auth's JWT verification.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users(id) values ('${alice}'), ('${bob}'), ('${charlie}');
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261017091513_create_groups.sql", import.meta.url), "utf8"));
});
after(async () => { await db?.close(); });

async function asUser(userId, callback, role = "authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try { return await callback(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
const create = (name, id) => db.query("select public.create_group($1, $2) as id", [name, id]);
const fails = (promise, code) => assert.rejects(promise, (error) => error.code === code);

test("anonymous users cannot read group data or execute group creation", async () => {
  await asUser(null, async () => {
    await fails(db.query("select * from public.groups"), "42501");
    await fails(db.query("select * from public.group_members"), "42501");
    await fails(create("Anonymous", groupA), "42501");
  }, "anon");
});

test("authenticated role without a user identity cannot create a group", async () => {
  await asUser(null, () => fails(create("Missing identity", groupA), "28000"));
});

test("creating a group saves its authenticated creator and membership together", async () => {
  const result = await asUser(alice, () => create("  週末のおでかけ  ", groupA));
  assert.equal(result.rows[0].id, groupA);
  const groups = await db.query("select id, name, created_by from public.groups where id = $1", [groupA]);
  assert.deepEqual(groups.rows, [{ id: groupA, name: "週末のおでかけ", created_by: alice }]);
  const memberships = await db.query("select group_id, user_id from public.group_members where group_id = $1", [groupA]);
  assert.deepEqual(memberships.rows, [{ group_id: groupA, user_id: alice }]);
});

test("retrying the same request creates neither a duplicate group nor membership", async () => {
  await asUser(alice, () => create("週末のおでかけ", groupA));
  assert.equal((await db.query("select count(*)::int as n from public.groups where id = $1", [groupA])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.group_members where group_id = $1", [groupA])).rows[0].n, 1);
  await asUser(alice, () => fails(create("Another name", groupA), "23505"));
  await asUser(bob, () => fails(create("週末のおでかけ", groupA), "23505"));
});

test("RLS hides another user's groups even when their IDs are directly specified", async () => {
  await asUser(bob, () => create("Bob's group", groupB));
  await asUser(alice, async () => {
    assert.deepEqual((await db.query("select id from public.groups")).rows, [{ id: groupA }]);
    assert.deepEqual((await db.query("select name from public.groups where id = $1", [groupB])).rows, []);
    assert.deepEqual((await db.query("select group_id from public.group_members")).rows, [{ group_id: groupA }]);
    assert.deepEqual((await db.query("select user_id from public.group_members where group_id = $1", [groupB])).rows, []);
  });
  await asUser(charlie, async () => {
    assert.deepEqual((await db.query("select id from public.groups")).rows, []);
  });
});

test("clients cannot join a different group or write tables around the RPC", async () => {
  await asUser(bob, async () => {
    await fails(db.query("insert into public.group_members (group_id,user_id) values ($1,$2)", [groupA, bob]), "42501");
    await fails(db.query("insert into public.groups (name,created_by) values ('forged',$1)", [alice]), "42501");
    await fails(db.query("update public.groups set name = 'forged' where id = $1", [groupA]), "42501");
    await fails(db.query("delete from public.groups where id = $1", [groupB]), "42501");
    await fails(db.query("delete from public.group_members where user_id = $1", [bob]), "42501");
  });
});

test("RPC rejects blank and overlong names without partially creating a group", async () => {
  const id = "10000000-0000-4000-8000-000000000003";
  for (const name of [null, "", " \t\n", "　", "\uFEFF", "\u00A0\u2000\u202F", "a".repeat(81)]) {
    await asUser(charlie, () => fails(create(name, id), "22023"));
  }
  await asUser(charlie, () => fails(create("Valid", null), "22023"));
  assert.deepEqual((await db.query("select id from public.groups where id = $1", [id])).rows, []);
});

test("membership failure rolls the group insertion back", async () => {
  const id = "10000000-0000-4000-8000-000000000004";
  await db.exec(`alter table public.group_members add constraint test_failure check (user_id <> '${charlie}'::uuid)`);
  try {
    await asUser(charlie, () => fails(create("Atomic save", id), "23514"));
    assert.deepEqual((await db.query("select id from public.groups where id = $1", [id])).rows, []);
    assert.deepEqual((await db.query("select group_id from public.group_members where group_id = $1", [id])).rows, []);
  } finally { await db.exec("alter table public.group_members drop constraint test_failure"); }
});

test("RLS also permits an existing member who did not create the group", async () => {
  // A future invitation transaction will perform this insert. No invitation
  // endpoint is exposed by this migration; only the test administrator adds it.
  await db.query("insert into public.group_members(group_id,user_id) values ($1,$2)", [groupA, bob]);
  await asUser(bob, async () => {
    const rows = (await db.query("select id from public.groups order by id")).rows;
    assert.deepEqual(rows, [{ id: groupA }, { id: groupB }]);
    assert.equal((await db.query("select count(*)::int as n from public.group_members where group_id = $1", [groupA])).rows[0].n, 1);
  });
});
