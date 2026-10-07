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
  const visit = repository.recordVisit(MOCK_GROUP_ID, outing.id, item.id, "楽しかった");
  assert.equal(repository.recordVisit(MOCK_GROUP_ID, outing.id, item.id).id, visit.id);
  const first = repository.completeOuting(MOCK_GROUP_ID, outing.id);
  const second = repository.completeOuting(MOCK_GROUP_ID, outing.id);
  assert.equal(first.id, second.id);
  assert.equal(repository.read(MOCK_GROUP_ID).memories.length, 1);
  assert.deepEqual(createMockRepository(storage).read(MOCK_GROUP_ID).memories[0].itemTitles, ["散歩"]);
});

test("finishing a plan does not mark unvisited candidates as visited", () => {
  const repository = createMockRepository(memoryStorage());
  const visited = repository.createItem(MOCK_GROUP_ID, { kind: "spot", title: "公園" });
  const skipped = repository.createItem(MOCK_GROUP_ID, { kind: "spot", title: "美術館" });
  const outing = repository.createOuting(MOCK_GROUP_ID, {
    title: "日帰り", itemIds: [visited.id, skipped.id],
  });
  repository.recordVisit(MOCK_GROUP_ID, outing.id, visited.id);
  const memory = repository.completeOuting(MOCK_GROUP_ID, outing.id);
  assert.deepEqual(memory.itemTitles, ["公園"]);
  assert.equal(repository.read(MOCK_GROUP_ID).visits.length, 1);
  assert.throws(() => repository.recordVisit(MOCK_GROUP_ID, outing.id, skipped.id), /終了/);
});

test("memory title and note edits persist without changing visited places", () => {
  const storage = memoryStorage();
  const repository = createMockRepository(storage);
  const item = repository.createItem(MOCK_GROUP_ID, { kind: "spot", title: "海" });
  const outing = repository.createOuting(MOCK_GROUP_ID, { title: "日帰り", itemIds: [item.id] });
  repository.recordVisit(MOCK_GROUP_ID, outing.id, item.id);
  const memory = repository.completeOuting(MOCK_GROUP_ID, outing.id);

  const edited = repository.updateMemory(MOCK_GROUP_ID, memory.id, { title: "  海の思い出  ", note: "  楽しかった  " });
  assert.equal(edited.title, "海の思い出");
  assert.equal(edited.note, "楽しかった");
  assert.deepEqual(edited.itemTitles, ["海"]);
  assert.deepEqual(createMockRepository(storage).read(MOCK_GROUP_ID).memories[0], edited);

  assert.throws(() => repository.updateMemory(MOCK_GROUP_ID, memory.id, { title: "   ", note: "失敗" }), /名前/);
  assert.throws(() => repository.updateMemory("another-group", memory.id, { title: "変更", note: "" }), /グループ/);
  assert.throws(() => repository.updateMemory(MOCK_GROUP_ID, "missing", { title: "変更", note: "" }), /思い出/);
  assert.deepEqual(repository.read(MOCK_GROUP_ID).memories[0], edited);
});

test("candidate edits persist while completed memories keep their original place name", () => {
  const storage = memoryStorage();
  const repository = createMockRepository(storage);
  const item = repository.createItem(MOCK_GROUP_ID, { kind: "spot", title: "旧い名前" });
  const outing = repository.createOuting(MOCK_GROUP_ID, { title: "日帰り", itemIds: [item.id] });
  repository.recordVisit(MOCK_GROUP_ID, outing.id, item.id);
  const memory = repository.completeOuting(MOCK_GROUP_ID, outing.id);

  const edited = repository.updateItem(MOCK_GROUP_ID, item.id, { title: "  新しい名前  ", note: "  メモ  " });
  assert.equal(edited.title, "新しい名前");
  assert.equal(edited.note, "メモ");
  assert.equal(edited.kind, "spot");
  const reloaded = createMockRepository(storage).read(MOCK_GROUP_ID);
  assert.deepEqual(reloaded.items.find((entry) => entry.id === item.id), edited);
  assert.deepEqual(reloaded.memories.find((entry) => entry.id === memory.id).itemTitles, ["旧い名前"]);

  assert.throws(() => repository.updateItem(MOCK_GROUP_ID, item.id, { title: "  ", note: "失敗" }), /名前/);
  assert.throws(() => repository.updateItem("another-group", item.id, { title: "変更", note: "" }), /グループ/);
  assert.throws(() => repository.updateItem(MOCK_GROUP_ID, "missing", { title: "変更", note: "" }), /候補/);
  assert.deepEqual(repository.read(MOCK_GROUP_ID).items.find((entry) => entry.id === item.id), edited);
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
    items: [null], outings: [], visits: [], memories: [],
  }));
  assert.throws(() => createMockRepository(storage).read(MOCK_GROUP_ID), /モックデータを読み込めません/);
});
