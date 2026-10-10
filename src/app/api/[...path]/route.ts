import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, moderationSchema } from "@/lib/validation";
import { POST_KINDS, type PostKind, type PostStatus } from "@/lib/types";
import { guest, isAdmin, requireAdmin, login, logout, checkOrigin } from "@/lib/server/auth";
import { backend } from "@/lib/server/config";
import { store } from "@/lib/server/store";
import { listPosts, publicPost, submit, limit } from "@/lib/server/service";
import { saveUpload, startVideoUpload, removePhysicalAsset, canReadAsset, serveMedia, mux } from "@/lib/server/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
type Context = { params: Promise<{ path: string[] }> };
async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") ?? 0) > max) throw new AppError("Ukuran unggahan terlalu besar.", 413);
  const reader = request.body?.getReader(); if (!reader) throw new AppError("Permintaan kosong.");
  const chunks: Uint8Array[] = []; let length = 0;
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.byteLength; if (length > max) { await reader.cancel(); throw new AppError("Ukuran unggahan terlalu besar.", 413); } chunks.push(chunk.value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function body(request: Request) { try { return JSON.parse((await boundedBody(request, 65536)).toString()); } catch (e) { if (e instanceof AppError) throw e; throw new AppError("Permintaan tidak valid."); } }
function uuid(value: string | undefined) { const id = z.uuid().safeParse(value); if (!id.success) throw new AppError("Tidak ditemukan.", 404); return id.data; }

async function route(request: NextRequest, context: Context) {
  try {
    const segments = (await context.params).path;
    const [resource, second, third] = segments;
    const method = request.method;
    const repository = await store();
    if (resource === "webhooks" && second === "mux" && method === "POST") {
      if (!process.env.MUX_WEBHOOK_SECRET) throw new AppError("Webhook belum diatur.", 503);
      let event;
      try { event = await mux().webhooks.unwrap((await boundedBody(request, 1048576)).toString(), request.headers); }
      catch { throw new AppError("Tanda tangan webhook tidak valid.", 401); }
      const eventData = event.data as unknown as { id?: string; asset_id?: string; passthrough?: string; duration?: number; playback_ids?: { id: string; policy: string }[] };
      if (event.type === "video.upload.asset_created" && eventData.id && eventData.asset_id) {
        const asset = await repository.assetByUpload(eventData.id);
        if (asset) await repository.saveAsset({ ...asset, muxAssetId: eventData.asset_id });
      }
      if (["video.asset.ready", "video.asset.errored"].includes(event.type) && eventData.id) {
        const asset = await repository.assetByMux(eventData.id) ?? (eventData.passthrough ? await repository.getAsset(eventData.passthrough) : null);
        if (asset) {
          const playbackId = eventData.playback_ids?.find(p => p.policy === "signed")?.id ?? null;
          const ready = event.type === "video.asset.ready" && (eventData.duration ?? Infinity) <= 120 && playbackId;
          await repository.saveAsset({ ...asset, muxAssetId: eventData.id, playbackId, status: ready ? "ready" : "failed" });
        }
      }
      return json({ received: true });
    }
    if (method !== "GET") checkOrigin(request);
    if (resource === "session" && method === "GET") return json({ admin: await isAdmin(), backend: backend() });
    if (resource === "posts" && method === "GET" && !second) {
      const scope = request.nextUrl.searchParams.get("scope") ?? "feed";
      if (!["feed", "mine", "admin"].includes(scope)) throw new AppError("Tampilan tidak valid.");
      const admin = scope === "admin"; if (admin) await requireAdmin();
      const ownerId = await guest(scope === "mine");
      const kind = request.nextUrl.searchParams.get("kind");
      const status = request.nextUrl.searchParams.get("status");
      const offset = Math.max(0, Math.min(10000, Number(request.nextUrl.searchParams.get("offset") ?? 0) || 0));
      return json(await listPosts({ scope: scope as "feed" | "mine" | "admin", ownerId: ownerId ?? undefined, kind: POST_KINDS.includes(kind as PostKind) ? kind as PostKind : undefined, status: ["pending", "approved", "rejected", "hidden"].includes(status ?? "") && admin ? status as PostStatus : undefined, search: (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100), offset }, ownerId));
    }
    if (resource === "posts" && method === "GET" && second) {
      const post = await repository.getPost(uuid(second)); const ownerId = await guest();
      if (!post || (post.status !== "approved" && post.ownerId !== ownerId && !await isAdmin())) throw new AppError("Kiriman tidak ditemukan.", 404);
      return json(await publicPost(post, ownerId, await isAdmin()));
    }
    if (resource === "posts" && ((method === "POST" && !second) || (method === "PUT" && second))) {
      const ownerId = (await guest(true))!; await limit(request, "submit", 10, ownerId);
      return json(await submit(await body(request), ownerId, second ? uuid(second) : undefined), method === "POST" ? 201 : 200);
    }
    if (resource === "posts" && second && third === "appreciate" && method === "POST") {
      const ownerId = (await guest(true))!; await limit(request, "appreciate", 120, ownerId);
      return json(await repository.toggleAppreciation(uuid(second), ownerId));
    }
    if (resource === "posts" && second && third === "report" && method === "POST") {
      const id = uuid(second); if ((await repository.getPost(id))?.status !== "approved") throw new AppError("Kiriman tidak ditemukan.", 404);
      const ownerId = (await guest(true))!; await limit(request, "report", 15, ownerId);
      const input = z.object({ reason: z.string().trim().min(3).max(500) }).parse(await body(request));
      await repository.report(id, ownerId, input.reason); return json({ ok: true });
    }
    if (resource === "uploads" && method === "POST") {
      const ownerId = (await guest(true))!; await limit(request, "upload", 25, ownerId);
      if (second === "video") return json(await startVideoUpload(ownerId, request.headers.get("origin")!));
      const raw = await boundedBody(request, (backend() === "local" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES) + 65536);
      const form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") ?? "" }, body: raw }).formData();
      const file = form.get("file"); if (!(file instanceof File)) throw new AppError("Pilih berkas terlebih dahulu.");
      const asset = await saveUpload(file, ownerId); return json({ id: asset.id, status: asset.status, url: `/api/media/${asset.id}` }, 201);
    }
    if (resource === "uploads" && second && method === "DELETE") {
      const asset = await repository.getAsset(uuid(second));
      if (!asset || asset.ownerId !== await guest() || asset.postId) throw new AppError("Unggahan tidak ditemukan.", 404);
      await removePhysicalAsset(asset); await repository.removeAsset(asset.id); return json({ ok: true });
    }
    if (["media", "video"].includes(resource) && second && method === "GET") {
      const asset = await repository.getAsset(uuid(second));
      if (!asset || !await canReadAsset(asset, await guest(), await isAdmin())) throw new AppError("Media tidak ditemukan.", 404);
      if (resource === "video") {
        if (!asset.playbackId || asset.status !== "ready") throw new AppError("Video belum tersedia.", 409);
        const tokens = await mux().jwt.signPlaybackId(asset.playbackId, { type: ["video", "thumbnail", "storyboard"], expiration: "10m" });
        return json({ playbackId: asset.playbackId, tokens });
      }
      return serveMedia(asset, request);
    }
    if (resource === "admin" && second === "login" && method === "POST") {
      await limit(request, "admin-login", 10);
      const input = z.object({ password: z.string().min(1).max(256) }).parse(await body(request));
      await login(input.password); return json({ ok: true });
    }
    if (resource === "admin" && second === "logout" && method === "POST") { await logout(); return json({ ok: true }); }
    if (resource === "admin" && second === "posts" && third && method === "POST") {
      await requireAdmin();
      const input = z.object({ revision: z.number().int().positive() }).and(moderationSchema).parse(await body(request));
      await repository.moderate(uuid(third), input.revision, input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "hidden", input.reason);
      return json({ ok: true });
    }
    throw new AppError("Tidak ditemukan.", 404);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message ?? "Periksa isian." }, 400);
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    console.error("API request failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Terjadi kendala. Coba lagi." }, 500);
  }
}
export const GET = route;
export const POST = route;
export const PUT = route;
export const DELETE = route;
