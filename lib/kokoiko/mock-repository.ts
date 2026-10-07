import type {
  Id,
  Item,
  ItemEdits,
  KokoikoRepository,
  KokoikoSnapshot,
  Memory,
  MemoryEdits,
  NewItem,
  NewOuting,
  Outing,
  ReactionValue,
  Visit,
} from "./contracts";

export const MOCK_GROUP_ID = "demo-group";
export const MOCK_MEMBER_ID = "demo-member";
const STORAGE_KEY = "kokoiko:p1-mock:v1";
const corruptDataMessage = "モックデータを読み込めません。保存内容を確認してください。";

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
  visits: [],
  memories: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isItem(value: unknown): value is Item {
  return isRecord(value) && typeof value.id === "string" && value.groupId === MOCK_GROUP_ID &&
    (value.kind === "spot" || value.kind === "activity") && typeof value.title === "string" &&
    typeof value.note === "string" && typeof value.createdAt === "string" &&
    (value.imageUrl === undefined || typeof value.imageUrl === "string") &&
    isRecord(value.reactions) && Object.entries(value.reactions).every(
      ([memberId, reaction]) => memberId === MOCK_MEMBER_ID &&
        (reaction === "want_to_go" || reaction === "not_now"),
    );
}

function isOuting(value: unknown): value is Outing {
  return isRecord(value) && typeof value.id === "string" && value.groupId === MOCK_GROUP_ID &&
    typeof value.title === "string" && (value.date === null || isDateOnly(value.date)) &&
    (value.status === "planning" || value.status === "completed") &&
    isStringArray(value.itemIds) && typeof value.note === "string";
}

function isMemory(value: unknown): value is Memory {
  return isRecord(value) && typeof value.id === "string" && value.groupId === MOCK_GROUP_ID &&
    typeof value.outingId === "string" && typeof value.title === "string" &&
    isStringArray(value.itemTitles) && typeof value.note === "string" &&
    typeof value.createdAt === "string";
}

function isVisit(value: unknown): value is Visit {
  return isRecord(value) && typeof value.id === "string" && value.groupId === MOCK_GROUP_ID &&
    typeof value.outingId === "string" && typeof value.itemId === "string" &&
    typeof value.note === "string" && typeof value.visitedAt === "string";
}

function isSnapshot(value: unknown): value is KokoikoSnapshot {
  return isRecord(value) && isRecord(value.group) &&
    value.group.id === MOCK_GROUP_ID && typeof value.group.name === "string" &&
    isStringArray(value.group.memberNames) &&
    Array.isArray(value.items) && value.items.every(isItem) &&
    Array.isArray(value.outings) && value.outings.every(isOuting) &&
    Array.isArray(value.visits) && value.visits.every(isVisit) &&
    Array.isArray(value.memories) && value.memories.every(isMemory);
}

function load(storage: Storage): KokoikoSnapshot {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialSnapshot);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(corruptDataMessage);
  }
  // Early P1 snapshots had no visit records. Keep those local drafts readable.
  if (isRecord(value) && value.visits === undefined) value.visits = [];
  if (!isSnapshot(value)) {
    throw new Error(corruptDataMessage);
  }
  return value;
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
        if (input.kind !== "spot" && input.kind !== "activity") throw new Error("候補の種類が正しくありません。");
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
    updateItem(groupId, itemId, edits: ItemEdits) {
      return update(groupId, (snapshot) => {
        const item = findItem(snapshot, groupId, itemId);
        if (typeof edits.title !== "string" || typeof edits.note !== "string") {
          throw new Error("候補の入力が正しくありません。");
        }
        item.title = requiredTitle(edits.title);
        item.note = edits.note.trim();
        return item;
      });
    },
    setReaction(groupId, itemId, memberId, value: ReactionValue | null) {
      return update(groupId, (snapshot) => {
        const item = findItem(snapshot, groupId, itemId);
        if (memberId !== MOCK_MEMBER_ID) throw new Error("メンバーが見つかりません。");
        if (value !== null && value !== "want_to_go" && value !== "not_now") {
          throw new Error("リアクションが正しくありません。");
        }
        if (value === null) delete item.reactions[memberId];
        else item.reactions[memberId] = value;
        return item;
      });
    },
    createOuting(groupId, input: NewOuting) {
      return update(groupId, (snapshot) => {
        if (input.date !== undefined && input.date !== null && !isDateOnly(input.date)) {
          throw new Error("日付が正しくありません。");
        }
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
    recordVisit(groupId, outingId, itemId, note = "") {
      return update(groupId, (snapshot) => {
        const outing = findOuting(snapshot, groupId, outingId);
        findItem(snapshot, groupId, itemId);
        if (outing.status === "completed") throw new Error("終了したおでかけには記録できません。");
        if (!outing.itemIds.includes(itemId)) throw new Error("計画にない候補は記録できません。");
        const existing = snapshot.visits.find((entry) => entry.outingId === outingId && entry.itemId === itemId);
        if (existing) return existing;
        const visit: Visit = {
          id: crypto.randomUUID(),
          groupId,
          outingId,
          itemId,
          note: note.trim(),
          visitedAt: new Date().toISOString(),
        };
        snapshot.visits.push(visit);
        return visit;
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
          itemTitles: snapshot.visits
            .filter((visit) => visit.outingId === outingId && visit.groupId === groupId)
            .map((visit) => findItem(snapshot, groupId, visit.itemId).title),
          note: outing.note,
          createdAt: new Date().toISOString(),
        };
        snapshot.memories.unshift(memory);
        return memory;
      });
    },
    updateMemory(groupId, memoryId, edits: MemoryEdits) {
      return update(groupId, (snapshot) => {
        const memory = snapshot.memories.find((entry) => entry.id === memoryId && entry.groupId === groupId);
        if (!memory) throw new Error("思い出が見つかりません。");
        if (typeof edits.title !== "string" || typeof edits.note !== "string") {
          throw new Error("思い出の入力が正しくありません。");
        }
        const title = requiredTitle(edits.title);
        memory.title = title;
        memory.note = edits.note.trim();
        return memory;
      });
    },
  };
}
