"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { placeListsAction, savePlaceAction, attachPlaceAction, type PlaceSaveState } from "@/app/app/map-actions";
import type { PlaceResult } from "@/lib/maps/explorer";
import type { PlaceGroup } from "@/lib/maps/saved";

const initial: PlaceSaveState = { error: null };
const field = "min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2";
function SaveForGroup({ groupId, place, query }: { groupId: string; place: PlaceResult; query: string }) {
  const requestId = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (previous: PlaceSaveState, form: FormData) => {
    // Allocate at submission, retaining the same UUID for retries in this group.
    requestId.current ??= crypto.randomUUID();
    form.set("requestId", requestId.current);
    return savePlaceAction(previous, form);
  }, initial);
  const [options, setOptions] = useState<{ lists: { id: string; name: string }[]; error?: string; more?: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    void placeListsAction(groupId).then(result => { if (active) setOptions(result); }).catch(() => { if (active) setOptions({ lists: [], error: "リストを取得できませんでした。保存後にも分類できます。" }); });
    return () => { active = false; };
  }, [groupId]);
  if (state.itemId && state.groupId) {
    const href = `/app/groups/${state.groupId}/items/${state.itemId}`;
    return <div className="kk-place-saved" role="status"><strong>{state.reused ? "この場所は、すでに行きたいにあります" : "みんなの行きたいに追加しました！"}</strong><p>{state.archived ? "アーカイブ中の候補です。詳細から復元できます。" : "選んだリストにも分類しました。次は、みんなで計画へ。"}</p><div className="flex flex-wrap gap-3"><Link className="kk-secondary-link" href={href}>候補をひらく →</Link>{!state.archived && <Link className="kk-primary-link" href={`/app/groups/${state.groupId}/outings/new?item=${state.itemId}`}>この場所で計画する →</Link>}</div></div>;
  }
  return <form action={action} className="mt-4 space-y-4" aria-label={`${place.name}を行きたいに保存`}>
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="placeId" value={place.id} />
    <fieldset disabled={pending} className="space-y-3">
      <label className="block space-y-2"><span className="text-sm font-semibold">自分たちの呼び名</span><input name="title" required maxLength={100} defaultValue={query || "気になる場所"} className={field} /><small className="block text-stone-600">検索した言葉を入れています。「週末のカフェ」など好きな呼び名に変えられます。</small></label>
      <details><summary className="kk-edit-button">リストにも追加（任意）</summary><div className="mt-2">{!options && <p role="status">リストを読み込んでいます…</p>}{options?.error && <p className="kk-muted">{options.error}</p>}{options?.lists.map(list => <label key={list.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" name="listIds" value={list.id} />{list.name}</label>)}{options && !options.error && !options.lists.length && <p className="kk-muted">リストはまだありません。保存後にも分類できます。</p>}{options?.more && <p className="kk-muted">最近の20件を表示しています。ほかのリストは保存後の詳細から選べます。</p>}</div></details>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="kk-primary-link">{pending ? "保存しています…" : "この場所を行きたいに追加 ＋"}</button>
    </fieldset>
  </form>;
}
export function PlaceSaveForm({ place, query, groups, defaultGroupId }: { place: PlaceResult; query: string; groups: PlaceGroup[]; defaultGroupId?: string }) {
  const [groupId, setGroupId] = useState(defaultGroupId ?? (groups.length === 1 ? groups[0].id : ""));
  return <section className="kk-place-save" aria-label="場所の保存先"><h3>ここ、行きたいに残そう</h3><label className="mt-3 block space-y-2"><span className="text-sm font-semibold">共有するグループ</span><select value={groupId} onChange={event => setGroupId(event.target.value)} className={field}><option value="">保存先を選ぶ</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>{groupId && <SaveForGroup key={groupId} groupId={groupId} place={place} query={query} />}</section>;
}
export function AttachPlaceForm({ groupId, itemId, placeId, expectedPlaceId, label }: { groupId: string; itemId: string; placeId: string | null; expectedPlaceId: string | null; label: string }) {
  const [state, action, pending] = useActionState(attachPlaceAction, initial);
  return <form action={action} className="kk-place-save space-y-3"><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="placeId" value={placeId ?? ""} /><input type="hidden" name="expectedPlaceId" value={expectedPlaceId ?? ""} /><p className="text-sm">{placeId ? "候補の名前・メモ・反応・計画はそのまま、この場所を紐づけます。" : "候補と記録は残し、地図の場所だけ解除します。"}</p><button className={placeId ? "kk-primary-link" : "kk-edit-button"} disabled={pending || Boolean(state.itemId)}>{pending ? "変更しています…" : label}</button>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.itemId && <p role="status">場所の紐づけを更新しました。</p>}</form>;
}
