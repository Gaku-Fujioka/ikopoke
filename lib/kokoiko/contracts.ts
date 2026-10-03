/** P1 screen/data contract. These shapes describe local mock data, not DB rows. */
export type Id = string;

export type ItemKind = "spot" | "activity";
export type ReactionValue = "want_to_go" | "not_now";
export type OutingStatus = "planning" | "completed";

export interface GroupSummary {
  id: Id;
  name: string;
  memberNames: string[];
}

export interface Item {
  id: Id;
  groupId: Id;
  kind: ItemKind;
  title: string;
  note: string;
  imageUrl?: string;
  createdAt: string;
  /** One current reaction per mock member. Absence means no reaction. */
  reactions: Record<Id, ReactionValue>;
}

export interface Outing {
  id: Id;
  groupId: Id;
  title: string;
  /** A date-only ISO value, or null while the plan has no date. */
  date: string | null;
  status: OutingStatus;
  /** Ordered item IDs. Removing one does not delete the saved item. */
  itemIds: Id[];
  note: string;
}

export interface Memory {
  id: Id;
  groupId: Id;
  outingId: Id;
  title: string;
  /** Ordered snapshots keep this mock memory readable if an item changes. */
  itemTitles: string[];
  note: string;
  createdAt: string;
}

export interface KokoikoSnapshot {
  group: GroupSummary;
  items: Item[];
  outings: Outing[];
  memories: Memory[];
}

export interface NewItem {
  kind: ItemKind;
  title: string;
  note?: string;
}

export interface NewOuting {
  title: string;
  date?: string | null;
  note?: string;
  itemIds?: Id[];
}

/**
 * Every operation is scoped to a group. The mock checks this in memory; it is
 * not an authorization boundary. Real persistence must enforce membership in
 * its API, database policies, and image access separately.
 */
export interface KokoikoRepository {
  read(groupId: Id): KokoikoSnapshot;
  createItem(groupId: Id, input: NewItem): Item;
  setReaction(groupId: Id, itemId: Id, memberId: Id, value: ReactionValue | null): Item;
  createOuting(groupId: Id, input: NewOuting): Outing;
  addItemToOuting(groupId: Id, outingId: Id, itemId: Id): Outing;
  completeOuting(groupId: Id, outingId: Id): Memory;
}
