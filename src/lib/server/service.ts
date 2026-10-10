import { createHmac, randomUUID } from "node:crypto";
import type { Post, StoredPost, Submission } from "../types";
import { store, type PostQuery } from "./store";
import { AppError, submissionSchema } from "../validation";
import { sessionSecret } from "./config";

export async function publicPost(post: StoredPost, guestId: string | null, admin = false): Promise<Post> {
  const repository = await store();
  const [assets, appreciation, reports] = await Promise.all([repository.assetsForPost(post.id), repository.appreciation(post.id, guestId), admin ? repository.reportCount(post.id) : Promise.resolve(undefined)]);
  const { ownerId: _ownerId, ...visible } = post;
  void _ownerId;
  return { ...visible, reason: admin || post.ownerId === guestId ? post.reason : "", assets: assets.map(a => ({ id: a.id, provider: a.provider, mime: a.mime, status: a.status, playbackId: a.playbackId, url: `/api/media/${a.id}` })), appreciations: appreciation.count, appreciated: appreciation.active, ...(admin ? { reports } : {}) };
}
export async function listPosts(query: PostQuery, guestId: string | null) {
  const rows = await (await store()).listPosts(query);
  return { posts: await Promise.all(rows.slice(0, 20).map(post => publicPost(post, guestId, query.scope === "admin"))), hasMore: rows.length > 20 };
}
export async function submit(input: unknown, ownerId: string, existingId?: string) {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Periksa isi kiriman.");
  const repository = await store();
  const old = existingId ? await repository.getPost(existingId) : null;
  if (existingId && (!old || old.ownerId !== ownerId)) throw new AppError("Kiriman tidak ditemukan.", 404);
  if (old?.status === "pending") throw new AppError("Kiriman sedang direview.", 409);
  const data: Submission = parsed.data;
  const post: StoredPost = { id: existingId ?? randomUUID(), ownerId, kind: data.kind, status: "pending", subject: data.subject, title: data.title, body: data.body, url: data.kind === "link" ? data.url : "", createdAt: old?.createdAt ?? new Date().toISOString(), publishedAt: null, reason: "", example: false, revision: (old?.revision ?? 0) + 1 };
  await repository.submit(post, data.assetIds);
  return publicPost(post, ownerId);
}
export async function limit(request: Request, action: string, max = 15, guestId?: string | null) {
  const address = process.env.VERCEL ? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown" : request.headers.get("x-real-ip") ?? "local";
  const key = createHmac("sha256", sessionSecret()).update(`${action}:${guestId ?? address}`).digest("hex");
  if (!await (await store()).consumeLimit(key, max, 3600000)) throw new AppError("Terlalu banyak permintaan. Coba lagi nanti.", 429);
}
