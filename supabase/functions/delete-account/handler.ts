type Problem = { code?: string } | null;
type Result<T> = PromiseLike<{ data: T; error: Problem }>;
export interface RemovalClient {
  auth: {
    getUser(token: string): PromiseLike<{ data: { user: { id: string; last_sign_in_at?: string | null } | null }; error: unknown }>;
    admin: { deleteUser(id: string, soft: boolean): PromiseLike<{ error: unknown }> };
  };
  rpc(name: string, args: Record<string, unknown>): Result<unknown>;
  storage: { from(bucket: string): { remove(paths: string[]): PromiseLike<{ error: unknown }> } };
}
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const idList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 1000 && v.every(uuid) && new Set(v).size === v.length;
const respond = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
/** The client must be server scoped, with no caller-controlled global headers. */
export async function deleteAccount(request: Request, admin: RemovalClient, now = Date.now()): Promise<Response> {
  if (request.method !== "POST") return respond(405, { error: "method_not_allowed" });
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ") || auth.length > 16384) return respond(401, { error: "unauthorized" });
  try {
    // Never infer a user ID from JWT decoding, request metadata, or the body.
    const verified = await admin.auth.getUser(auth.slice(7));
    const user = verified.data.user;
    if (verified.error || !user || !uuid(user.id)) return respond(401, { error: "unauthorized" });
    const signedIn = Date.parse(user.last_sign_in_at ?? "");
    if (!Number.isFinite(signedIn) || now-signedIn > 300000 || signedIn > now+60000) return respond(403, { error: "recent_login_required" });
    const text = await request.text();
    if (text.length > 131072) return respond(400, { error: "invalid_request" });
    let body: Record<string, unknown>;
    try { const value: unknown = JSON.parse(text); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; }
    catch { return respond(400, { error: "invalid_request" }); }
    const groupIds=body.groupIds,deleteGroupIds=body.deleteGroupIds;
    if (body.confirm !== "delete-my-account" || !uuid(body.requestId) || !idList(groupIds) || !idList(deleteGroupIds) || deleteGroupIds.some(id => !groupIds.includes(id))) return respond(400, { error: "invalid_request" });
    const args = { p_user_id: user.id, p_request_id: body.requestId };
    const prepared = await admin.rpc("prepare_account_deletion", { ...args, p_group_ids: groupIds, p_delete_group_ids: deleteGroupIds });
    if (prepared.error) return respond(prepared.error.code === "40001" ? 409 : 503, { error: prepared.error.code === "40001" ? "membership_changed" : "retry_required" });
    for (let batch = 0; batch < 20; batch++) {
      const paths = await admin.rpc("get_account_cleanup_paths", args);
      if (paths.error || !Array.isArray(paths.data) || paths.data.length > 1000) return respond(503, { error: "retry_required" });
      const names: string[] = [];
      for (const row of paths.data) {
        if (!row || typeof row !== "object" || !("object_path" in row) || typeof row.object_path !== "string") return respond(503, { error: "retry_required" });
        const parts = row.object_path.split("/");
        const visitPath = uuid(parts[0]) && uuid(parts[1]) && deleteGroupIds.includes(parts[0]);
        const profilePath = (parts[0] === "profile-avatar" && parts[1] === user.id) || (parts[0] === "profile-cover" && deleteGroupIds.includes(parts[1]));
        if (parts.length !== 3 || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(parts[2]) || (!visitPath && !profilePath)) return respond(503, { error: "retry_required" });
        names.push(row.object_path);
      }
      if (!names.length) break;
      const removed = await admin.storage.from("visit-photos").remove(names);
      if (removed.error) return respond(503, { error: "retry_required" });
    }
    const finished = await admin.rpc("finish_account_data", args);
    if (finished.error) return respond(503, { error: "retry_required" });
    // Supabase's irreversible soft deletion scrubs login identity and sessions
    // while retaining the identity row referenced by shared records/Storage.
    const deleted = await admin.auth.admin.deleteUser(user.id, true);
    if (deleted.error) return respond(503, { error: "retry_required" });
    const complete = await admin.rpc("complete_account_deletion", args);
    if (complete.error) return respond(503, { error: "retry_required" });
    return respond(200, { ok: true });
  } catch { return respond(503, { error: "retry_required" }); }
}
