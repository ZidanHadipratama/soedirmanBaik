import { createClient } from "@supabase/supabase-js";
import type { Asset, StoredPost } from "../types";
import { AppError } from "../validation";
import type { Store } from "./store";

export function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
type Result = { error: { message: string } | null };
function check(result: Result) { if (result.error) throw new AppError("Penyimpanan sedang tidak tersedia. Coba lagi.", 503); }
export const supabaseStore: Store = {
  async listPosts(q) {
    let query = supabase().from("posts").select("data").order(q.scope === "feed" ? "published_at" : "created_at", { ascending: false });
    if (q.scope === "feed") query = query.eq("status", "approved");
    if (q.scope === "mine") query = query.eq("owner_id", q.ownerId!);
    if (q.status) query = query.eq("status", q.status);
    if (q.kind) query = query.eq("data->>kind", q.kind);
    if (q.search) query = query.ilike("search_text", `%${q.search.replace(/[\\%_]/g, "\\$&")}%`);
    const result = await query.range(q.offset ?? 0, (q.offset ?? 0) + 20); check(result);
    return (result.data ?? []).map(row => row.data as StoredPost);
  },
  async getPost(id) { const r = await supabase().from("posts").select("data").eq("id", id).maybeSingle(); check(r); return r.data?.data as StoredPost ?? null; },
  async submit(post, assetIds) { const r = await supabase().rpc("submit_post", { post_data: post, asset_ids: assetIds }); if (r.error?.message.includes("conflict")) throw new AppError("Kiriman sedang direview atau unggahan sudah dipakai.", 409); check(r); },
  async moderate(id, revision, status, reason) { const r = await supabase().rpc("moderate_post", { post_id: id, expected_revision: revision, next_status: status, review_reason: reason }); if (r.error?.message.includes("conflict")) throw new AppError("Kiriman berubah atau video belum siap. Muat ulang.", 409); check(r); },
  async getAsset(id) { const r = await supabase().from("assets").select("data").eq("id", id).maybeSingle(); check(r); return r.data?.data as Asset ?? null; },
  async assetsForPost(id) { const r = await supabase().from("assets").select("data").eq("post_id", id).order("created_at"); check(r); return (r.data ?? []).map(row => row.data as Asset); },
  async saveAsset(asset) { const r = await supabase().from("assets").upsert({ id: asset.id, owner_id: asset.ownerId, post_id: asset.postId, upload_id: asset.uploadId, mux_asset_id: asset.muxAssetId, created_at: asset.createdAt, data: asset }); check(r); },
  async assetByUpload(id) { const r = await supabase().from("assets").select("data").eq("upload_id", id).maybeSingle(); check(r); return r.data?.data as Asset ?? null; },
  async assetByMux(id) { const r = await supabase().from("assets").select("data").eq("mux_asset_id", id).maybeSingle(); check(r); return r.data?.data as Asset ?? null; },
  async removeAsset(id) { const r = await supabase().from("assets").delete().eq("id", id).is("post_id", null); check(r); },
  async appreciation(id, guest) {
    const r = await supabase().from("appreciations").select("guest_id", { count: "exact", head: true }).eq("post_id", id); check(r);
    const own = guest ? await supabase().from("appreciations").select("guest_id").eq("post_id", id).eq("guest_id", guest).maybeSingle() : null;
    if (own) check(own); return { count: r.count ?? 0, active: Boolean(own?.data) };
  },
  async toggleAppreciation(id, guest) { const r = await supabase().rpc("toggle_appreciation", { target_post: id, actor: guest }); check(r); return r.data as { count: number; active: boolean }; },
  async report(id, guest, reason) { const r = await supabase().from("reports").upsert({ post_id: id, guest_id: guest, reason }, { onConflict: "post_id,guest_id" }); check(r); },
  async reportCount(id) { const r = await supabase().from("reports").select("post_id", { count: "exact", head: true }).eq("post_id", id); check(r); return r.count ?? 0; },
  async consumeLimit(key, max, windowMs) { const r = await supabase().rpc("consume_rate_limit", { limit_key: key, max_count: max, window_ms: windowMs }); check(r); return r.data as boolean; },
};
