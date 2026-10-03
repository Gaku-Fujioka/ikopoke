import assert from "node:assert/strict";
import test from "node:test";
import { createMockRepository, MOCK_GROUP_ID, MOCK_MEMBER_ID } from "../lib/kokoiko/mock-repository.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test("a candidate can be reacted to, planned, and kept in one memory", () => {
  const storage = memoryStorage();
  const repository = createMockRepository(storage);
  const item = repository.createItem(MOCK_GROUP_ID, { kind: "activity", title: "  散歩  " });
  assert.equal(item.title, "散歩");

  repository.setReaction(MOCK_GROUP_ID, item.id, MOCK_MEMBER_ID, "want_to_go");
  repository.setReaction(MOCK_GROUP_ID, item.id, MOCK_MEMBER_ID, "not_now");
  assert.deepEqual(repository.read(MOCK_GROUP_ID).items.find((entry) => entry.id === item.id).reactions, {
    [MOCK_MEMBER_ID]: "not_now",
  });

  const outing = repository.createOuting(MOCK_GROUP_ID, { title: "週末", itemIds: [item.id, item.id] });
  assert.deepEqual(outing.itemIds, [item.id]);
  const first = repository.completeOuting(MOCK_GROUP_ID, outing.id);
  const second = repository.completeOuting(MOCK_GROUP_ID, outing.id);
  assert.equal(first.id, second.id);
  assert.equal(repository.read(MOCK_GROUP_ID).memories.length, 1);
  assert.deepEqual(createMockRepository(storage).read(MOCK_GROUP_ID).memories[0].itemTitles, ["散歩"]);
});

test("a different group cannot read or link the demo group's items", () => {
  const repository = createMockRepository(memoryStorage());
  assert.throws(() => repository.read("another-group"), /グループ/);
  assert.throws(() => repository.createOuting(MOCK_GROUP_ID, {
    title: "無効な候補",
    itemIds: ["another-group-item"],
  }), /候補/);
  assert.equal(repository.read(MOCK_GROUP_ID).outings.length, 0);
});

test("invalid runtime input is rejected before it reaches local storage", () => {
  const repository = createMockRepository(memoryStorage());
  assert.throws(() => repository.createItem(MOCK_GROUP_ID, { kind: "invalid", title: "abc" }), /種類/);
  const item = repository.createItem(MOCK_GROUP_ID, { kind: "spot", title: "公園" });
  assert.throws(() => repository.setReaction(MOCK_GROUP_ID, item.id, MOCK_MEMBER_ID, "invalid"), /リアクション/);
  assert.throws(() => repository.setReaction(MOCK_GROUP_ID, item.id, "stranger", "want_to_go"), /メンバー/);
  assert.throws(() => repository.createOuting(MOCK_GROUP_ID, { title: "無効", date: "2026-99-99" }), /日付/);
  assert.equal(repository.read(MOCK_GROUP_ID).outings.length, 0);
});

test("corrupt local data reports a controlled error", () => {
  const storage = memoryStorage();
  storage.setItem("kokoiko:p1-mock:v1", JSON.stringify({
    group: { id: MOCK_GROUP_ID, name: "demo", memberNames: [] },
    items: [null], outings: [], memories: [],
  }));
  assert.throws(() => createMockRepository(storage).read(MOCK_GROUP_ID), /モックデータを読み込めません/);
});
