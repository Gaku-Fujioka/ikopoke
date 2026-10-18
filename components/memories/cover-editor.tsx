"use client";
import { useActionState } from "react";
import type { SavedMemory } from "@/lib/memories/repository";
import type { VisitPhoto } from "@/lib/visits/repository";
import { saveCoverAction } from "@/app/app/groups/[groupId]/memories/cover-actions";
import { PrivateVisitImage } from "@/components/visits/private-visit-image";
export function CoverEditor({ memory, photos }: { memory: SavedMemory; photos: VisitPhoto[] }) {
  const [state, action, pending] = useActionState(saveCoverAction, { error: null });
  return <details className="kk-surface"><summary className="min-h-11 cursor-pointer font-semibold">表紙の写真を選ぶ</summary><form key={memory.revision} action={action} aria-busy={pending} className="mt-3 space-y-4"><input type="hidden" name="groupId" value={memory.group_id} /><input type="hidden" name="memoryId" value={memory.id} /><input type="hidden" name="revision" value={memory.revision} /><label className="flex min-h-11 items-center gap-3"><input type="radio" name="photoId" value="" defaultChecked={!memory.cover_photo_id} />写真を使わない</label><div className="grid grid-cols-2 gap-4">{photos.map((photo, index) => <label key={photo.id} className="space-y-2 rounded-xl border p-2"><PrivateVisitImage path={photo.object_path} contentType={photo.content_type} alt={`表紙に選べる写真 ${index+1}`} /><span className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="photoId" value={photo.id} defaultChecked={memory.cover_photo_id === photo.id} />この写真を表紙にする</span></label>)}</div>{!photos.length && <p className="text-sm text-stone-600">このアルバムの訪問記録に写真を追加すると、表紙に選べます。</p>}<button disabled={pending} className="kk-primary-link">{pending ? "保存中…" : "表紙を保存"}</button>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.saved && <p role="status">表紙を保存しました。</p>}</form></details>;
}
