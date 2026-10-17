"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { createGroupAction } from "@/app/app/groups/actions";

export function CreateGroupForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(createGroupAction, { error: null });
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (state.fieldError) nameRef.current?.focus(); }, [state]);

  return (
    <section aria-labelledby="create-group-title" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 id="create-group-title" className="text-xl font-semibold">新しいグループを作る</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">まずは1人で始められます。名前を付けて保存しましょう。</p>
      <form action={action} aria-busy={pending} className="mt-5 space-y-4">
        <input type="hidden" name="requestId" value={requestId} />
        <div className="space-y-2">
          <label htmlFor="group-name" className="block text-sm font-semibold">グループの名前 <span className="text-orange-700">必須</span></label>
          <input ref={nameRef} id="group-name" name="name" required value={name} onChange={(event) => setName(event.target.value)} disabled={pending} aria-describedby={state.error ? "group-name-help group-error" : "group-name-help"} aria-invalid={state.fieldError ?? false} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60" placeholder="例：週末のおでかけ" />
          <p id="group-name-help" className="text-xs leading-5 text-stone-500">80文字以内で入力してください。</p>
        </div>
        {state.error && <p id="group-error" role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? "保存中…" : "グループを作成"}</button>
      </form>
    </section>
  );
}
