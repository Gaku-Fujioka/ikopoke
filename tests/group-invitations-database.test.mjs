import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

const { PGlite } = await import(process.env.KOKOIKO_PGLITE_MODULE_URL ?? "@electric-sql/pglite");
let db;
const alice = "00000000-0000-4000-8000-000000000001", bob = "00000000-0000-4000-8000-000000000002", charlie = "00000000-0000-4000-8000-000000000003";
const groupA = "10000000-0000-4000-8000-000000000001", groupB = "10000000-0000-4000-8000-000000000002";
const token = "a".repeat(64), revokedToken = "b".repeat(64), expiredToken = "c".repeat(64);
const hash = (value) => createHash("sha256").update(value).digest("hex");
let invitationId;
before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users(id) values ('${alice}'),('${bob}'),('${charlie}');
  `);
  for (const name of ["20261017091513_create_groups.sql", "20261017093000_create_group_invites.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  await asUser(alice, () => db.query("select public.create_group('Group A',$1)", [groupA]));
  await asUser(bob, () => db.query("select public.create_group('Group B',$1)", [groupB]));
});
after(async () => { await db?.close(); });
async function asUser(userId, work, role = "authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId ?? ""]);
  try { return await work(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','','false')"); }
}
const fails = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const issue = (groupId, value) => db.query("select * from public.create_group_invite($1,$2)", [groupId,hash(value)]);
const preview = (value) => db.query("select * from public.preview_group_invite($1)", [value]);
const join = (value, groupId) => db.query("select public.accept_group_invite($1,$2) as id", [value,groupId]);

test("anonymous users cannot execute any invitation RPC or read metadata", async () => {
  await asUser(null, async () => {
    await fails(issue(groupA,token),"42501");
    await fails(preview(token),"42501");
    await fails(join(token,groupA),"42501");
    await fails(db.query("select public.revoke_group_invite($1)",[groupA]),"42501");
    await fails(db.query("select id from public.group_invites"),"42501");
  }, "anon");
});
test("non-members and sessions without identity cannot issue invitations", async () => {
  await asUser(bob, () => fails(issue(groupA,token),"42501"));
  await asUser(null, () => fails(issue(groupA,token),"42501"));
  await asUser(null, () => fails(preview(token),"28000"));
  await asUser(null, () => fails(join(token,groupA),"28000"));
});
test("members issue a seven-day invitation and only a hash is stored", async () => {
  const result = await asUser(alice, () => issue(groupA,token));
  invitationId = result.rows[0].id;
  const { rows } = await db.query("select *, extract(epoch from(expires_at-created_at)) as seconds from public.group_invites where id=$1",[invitationId]);
  assert.equal(rows[0].token_hash,hash(token)); assert.notEqual(rows[0].token_hash,token);
  assert.equal(rows[0].created_by,alice); assert.equal(Number(rows[0].seconds),7*86400);
});
test("members can list metadata but cannot read hashes or write invitation rows directly", async () => {
  await asUser(alice, async () => {
    assert.equal((await db.query("select id from public.group_invites")).rows.length,1);
    await fails(db.query("select token_hash from public.group_invites"),"42501");
    await fails(db.query("insert into public.group_invites(group_id,token_hash,created_by) values($1,$2,$3)",[groupA,hash("d".repeat(64)),alice]),"42501");
    await fails(db.query("update public.group_invites set revoked_at=now()"),"42501");
    await fails(db.query("delete from public.group_invites"),"42501");
  });
});
test("a non-member cannot read even a directly specified invitation ID", async () => {
  const result = await asUser(bob, () => db.query("select id from public.group_invites where id=$1",[invitationId]));
  assert.deepEqual(result.rows,[]);
  await asUser(bob, () => fails(db.query("select public.revoke_group_invite($1)",[invitationId]),"42501"));
});
test("valid tokens allow a read-only preview without adding membership", async () => {
  const result = await asUser(bob, () => preview(token));
  assert.equal(result.rows[0].group_name,"Group A"); assert.equal(result.rows[0].group_id,groupA);
  assert.equal((await db.query("select 1 from public.group_members where group_id=$1 and user_id=$2",[groupA,bob])).rows.length,0);
});
test("invalid tokens and token hashes disclose no group", async () => {
  for (const value of [null,"", "a", "z".repeat(64), "d".repeat(64),hash(token)]) {
    await asUser(bob, () => fails(preview(value),"P0001"));
    await asUser(bob, () => fails(join(value,groupA),"P0001"));
  }
});
test("the confirmed target must match the token's group", async () => {
  await asUser(bob, () => fails(join(token,groupB),"P0001"));
  await asUser(bob, () => fails(join(token,null),"P0001"));
});
test("one reusable link adds multiple distinct authenticated members", async () => {
  for (const actor of [bob,charlie]) assert.equal((await asUser(actor, () => join(token,groupA))).rows[0].id,groupA);
  assert.equal((await db.query("select 1 from public.group_members where group_id=$1",[groupA])).rows.length,3);
});
test("rejoining is idempotent and newly joined members see the group through RLS", async () => {
  await asUser(bob, () => join(token,groupA));
  assert.equal((await asUser(charlie, () => db.query("select id from public.groups where id=$1",[groupA]))).rows.length,1);
  assert.equal((await db.query("select 1 from public.group_members where group_id=$1",[groupA])).rows.length,3);
});
test("a member other than the creator can issue and revoke invitations", async () => {
  const created = await asUser(bob, () => issue(groupA,revokedToken));
  await asUser(charlie, () => db.query("select public.revoke_group_invite($1)",[created.rows[0].id]));
  await asUser(charlie, () => db.query("select public.revoke_group_invite($1)",[created.rows[0].id]));
  await asUser(alice, () => fails(preview(revokedToken),"P0001"));
  await asUser(alice, () => fails(join(revokedToken,groupA),"P0001"));
  assert.equal((await db.query("select 1 from public.group_members where group_id=$1",[groupA])).rows.length,3);
});
test("expired invitations fail preview and join and cannot be extended by the caller", async () => {
  const created = await asUser(alice, () => issue(groupA,expiredToken));
  await db.query("update public.group_invites set expires_at=now()-interval '1 second' where id=$1",[created.rows[0].id]);
  await asUser(bob, () => fails(preview(expiredToken),"P0001"));
  await asUser(bob, () => fails(join(expiredToken,groupA),"P0001"));
});
test("malformed hashes and duplicate hashes fail without adding a new invitation", async () => {
  await asUser(alice, () => fails(db.query("select * from public.create_group_invite($1,$2)",[groupA,null]),"22023"));
  await asUser(alice, () => fails(issue(groupA,token),"23505"));
  assert.equal((await db.query("select 1 from public.group_invites")).rows.length,3);
});
