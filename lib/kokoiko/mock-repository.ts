import type {
  Id,
  Item,
  KokoikoRepository,
  KokoikoSnapshot,
  Memory,
  NewItem,
  NewOuting,
  Outing,
  ReactionValue,
} from "./contracts";

export const MOCK_GROUP_ID = "demo-group";
export const MOCK_MEMBER_ID = "demo-member";
const STORAGE_KEY = "kokoiko:p1-mock:v1";

const initialSnapshot: KokoikoSnapshot = {
  group: {
    id: MOCK_GROUP_ID,
    name: "デモグループ",
    memberNames: ["あなた", "メンバー"],
  },
  items: [
    {
      id: "demo-item-cafe",
      groupId: MOCK_GROUP_ID,
      kind: "spot",
      title: "気になるカフェ",
      note: "週末に寄ってみたい場所",
      createdAt: "2026-10-01T00:00:00.000Z",
      reactions: {},
    },
    {
      id: "demo-item-pottery",
      groupId: MOCK_GROUP_ID,
      kind: "activity",
      title: "陶芸を体験する",
      note: "場所はこれから探す",
      createdAt: "2026-10-02T00:00:00.000Z",
      reactions: {},
    },
  ],
  outings: [],
  memories: [],
};

function load(storage: Storage): KokoikoSnapshot {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialSnapshot);
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("group" in value) ||
    !("items" in value) ||
    !("outings" in value) ||
    !("memories" in value) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.outings) ||
    !Array.isArray(value.memories)
  ) {
    throw new Error("モックデータを読み込めません。保存内容を確認してください。");
  }
  return value as KokoikoSnapshot;
}

function assertGroup(snapshot: KokoikoSnapshot, groupId: Id): void {
  if (snapshot.group.id !== groupId) throw new Error("グループが見つかりません。");
}

function requiredTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("名前を入力してください。");
  return trimmed;
}

function findItem(snapshot: KokoikoSnapshot, groupId: Id, itemId: Id): Item {
  const item = snapshot.items.find((entry) => entry.id === itemId && entry.groupId === groupId);
  if (!item) throw new Error("候補が見つかりません。");
  return item;
}

function findOuting(snapshot: KokoikoSnapshot, groupId: Id, outingId: Id): Outing {
  const outing = snapshot.outings.find((entry) => entry.id === outingId && entry.groupId === groupId);
  if (!outing) throw new Error("おでかけが見つかりません。");
  return outing;
}

/** Browser-only local demo. Never use this as real group authorization or shared storage. */
export function createMockRepository(storage: Storage): KokoikoRepository {
  function update<T>(groupId: Id, change: (snapshot: KokoikoSnapshot) => T): T {
    const snapshot = load(storage);
    assertGroup(snapshot, groupId);
    const result = change(snapshot);
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return structuredClone(result);
  }

  return {
    read(groupId) {
      const snapshot = load(storage);
      assertGroup(snapshot, groupId);
      return structuredClone(snapshot);
    },
    createItem(groupId, input: NewItem) {
      return update(groupId, (snapshot) => {
        const item: Item = {
          id: crypto.randomUUID(),
          groupId,
          kind: input.kind,
          title: requiredTitle(input.title),
          note: input.note?.trim() ?? "",
          createdAt: new Date().toISOString(),
          reactions: {},
        };
        snapshot.items.unshift(item);
        return item;
      });
    },
    setReaction(groupId, itemId, memberId, value: ReactionValue | null) {
      return update(groupId, (snapshot) => {
        const item = findItem(snapshot, groupId, itemId);
        if (!memberId.trim()) throw new Error("メンバーが見つかりません。");
        if (value === null) delete item.reactions[memberId];
        else item.reactions[memberId] = value;
        return item;
      });
    },
    createOuting(groupId, input: NewOuting) {
      return update(groupId, (snapshot) => {
        const itemIds = [...new Set(input.itemIds ?? [])];
        itemIds.forEach((id) => findItem(snapshot, groupId, id));
        const outing: Outing = {
          id: crypto.randomUUID(),
          groupId,
          title: requiredTitle(input.title),
          date: input.date ?? null,
          status: "planning",
          itemIds,
          note: input.note?.trim() ?? "",
        };
        snapshot.outings.unshift(outing);
        return outing;
      });
    },
    addItemToOuting(groupId, outingId, itemId) {
      return update(groupId, (snapshot) => {
        const outing = findOuting(snapshot, groupId, outingId);
        findItem(snapshot, groupId, itemId);
        if (outing.status === "completed") throw new Error("終了したおでかけは変更できません。");
        if (!outing.itemIds.includes(itemId)) outing.itemIds.push(itemId);
        return outing;
      });
    },
    completeOuting(groupId, outingId) {
      return update(groupId, (snapshot) => {
        const outing = findOuting(snapshot, groupId, outingId);
        const existing = snapshot.memories.find((entry) => entry.outingId === outingId && entry.groupId === groupId);
        if (existing) return existing;
        outing.status = "completed";
        const memory: Memory = {
          id: crypto.randomUUID(),
          groupId,
          outingId,
          title: outing.title,
          itemTitles: outing.itemIds.map((id) => findItem(snapshot, groupId, id).title),
          note: outing.note,
          createdAt: new Date().toISOString(),
        };
        snapshot.memories.unshift(memory);
        return memory;
      });
    },
  };
}
