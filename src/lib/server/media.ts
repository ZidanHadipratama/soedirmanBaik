import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import sharp from "sharp";
import Mux from "@mux/ts";
import { backend, dataDirectory } from "./config";
import { supabase } from "./store-supabase";
import { store } from "./store";
import { AppError, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, validateVideo } from "../validation";
import type { Asset } from "../types";

export function mux() {
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) throw new AppError("Layanan video belum terhubung.", 503);
  return new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET, jwtSigningKey: process.env.MUX_SIGNING_KEY_ID, jwtPrivateKey: process.env.MUX_SIGNING_PRIVATE_KEY, webhookSecret: process.env.MUX_WEBHOOK_SECRET });
}
export async function saveUpload(file: File, ownerId: string): Promise<Asset> {
  const video = file.type.startsWith("video/");
  if (file.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES) || file.size === 0) throw new AppError(video ? "Video maksimal 50 MB." : "Foto maksimal 10 MB.", 413);
  if (video && backend() !== "local") throw new AppError("Gunakan unggahan video langsung.");
  let bytes = Buffer.from(await file.arrayBuffer());
  let mime = file.type;
  if (video) {
    if (!validateVideo(bytes, mime)) throw new AppError("Gunakan video MP4 atau WebM yang valid.");
  } else {
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new AppError("Gunakan foto JPG, PNG, atau WebP.");
    try { bytes = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize(1800, 1800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer(); mime = "image/webp"; }
    catch { throw new AppError("Foto tidak dapat dibaca. Pilih foto lain."); }
  }
  const id = randomUUID();
  const storagePath = `${id}.${video ? mime === "video/mp4" ? "mp4" : "webm" : "webp"}`;
  const asset: Asset = { id, ownerId, postId: null, provider: backend() === "local" ? "local" : "supabase", path: storagePath, mime, size: bytes.length, status: "ready", uploadId: null, muxAssetId: null, playbackId: null, createdAt: new Date().toISOString() };
  if (asset.provider === "local") { const dir = path.join(dataDirectory(), "uploads"); await mkdir(dir, { recursive: true, mode: 0o700 }); await writeFile(path.join(dir, storagePath), bytes, { mode: 0o600 }); }
  else { const r = await supabase().storage.from("post-media").upload(storagePath, bytes, { contentType: mime, upsert: false }); if (r.error) throw new AppError("Unggahan gagal. Coba lagi.", 503); }
  try { await (await store()).saveAsset(asset); } catch (e) { await removePhysicalAsset(asset); throw e; }
  return asset;
}
export async function startVideoUpload(ownerId: string, origin: string) {
  const client = mux();
  const id = randomUUID();
  const upload = await client.video.uploads.create({ cors_origin: origin, timeout: 3600, new_asset_settings: { playback_policies: ["signed"], video_quality: "basic", passthrough: id } });
  const asset: Asset = { id, ownerId, postId: null, provider: "mux", path: "", mime: "video/mp4", size: 0, status: "processing", uploadId: upload.id, muxAssetId: null, playbackId: null, createdAt: new Date().toISOString() };
  await (await store()).saveAsset(asset);
  return { asset: { id: asset.id, status: asset.status }, uploadUrl: upload.url };
}
export async function removePhysicalAsset(asset: Asset) {
  if (asset.provider === "local") await unlink(path.join(dataDirectory(), "uploads", asset.path)).catch(() => {});
  if (asset.provider === "supabase") { const r = await supabase().storage.from("post-media").remove([asset.path]); if (r.error) throw new AppError("Unggahan belum dapat dihapus.", 503); }
  if (asset.provider === "mux") {
    if (asset.muxAssetId) await mux().video.assets.delete(asset.muxAssetId);
    else if (asset.uploadId) await mux().video.uploads.cancel(asset.uploadId);
  }
}
export async function canReadAsset(asset: Asset, ownerId: string | null, admin: boolean) {
  if (admin || asset.ownerId === ownerId) return true;
  return Boolean(asset.postId && (await (await store()).getPost(asset.postId))?.status === "approved");
}
export async function serveMedia(asset: Asset, request: Request) {
  if (asset.status !== "ready") throw new AppError("Media belum tersedia.", 409);
  if (asset.provider === "supabase") {
    const r = await supabase().storage.from("post-media").createSignedUrl(asset.path, 60);
    if (r.error || !r.data) throw new AppError("Media tidak ditemukan.", 404);
    return new Response(null, { status: 302, headers: { Location: r.data.signedUrl, "Cache-Control": "private, no-store" } });
  }
  if (asset.provider !== "local") throw new AppError("Gunakan pemutar video.");
  const file = path.join(dataDirectory(), "uploads", asset.path);
  const size = (await stat(file).catch(() => { throw new AppError("Media tidak ditemukan.", 404); })).size;
  const headers: Record<string, string> = { "Content-Type": asset.mime, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  let start = 0, end = size - 1, status = 200;
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(size - 1, Number(match[2])); }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206; headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status, headers });
}
