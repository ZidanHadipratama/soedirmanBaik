import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Asset, StoredPost, PostStatus } from "../types";
import { AppError } from "../validation";
import { dataDirectory } from "./config";
import type { PostQuery, Store } from "./store";

let database: DatabaseSync | undefined;
export function db() {
  if (database) return database;
  database = new DatabaseSync(path.join(dataDirectory(), "soedirman.sqlite"));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, published_at TEXT, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS posts_feed ON posts(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS posts_owner ON posts(owner_id);
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, post_id TEXT, upload_id TEXT, mux_asset_id TEXT, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS assets_post ON assets(post_id);
    CREATE TABLE IF NOT EXISTS appreciations (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, guest_id TEXT NOT NULL, PRIMARY KEY(post_id,guest_id));
    CREATE TABLE IF NOT EXISTS reports (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, guest_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(post_id,guest_id));
    CREATE TABLE IF NOT EXISTS moderation_events (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
  return database;
}
type DocumentRow = { data: string };
function unpack<T>(row: unknown): T | null { return row ? JSON.parse((row as DocumentRow).data) as T : null; }
function transaction<T>(operation: () => T): T {
  const database = db(); database.exec("BEGIN IMMEDIATE");
  try { const value = operation(); database.exec("COMMIT"); return value; }
  catch (e) { database.exec("ROLLBACK"); throw e; }
}
function putPost(post: StoredPost) {
  db().prepare("INSERT INTO posts VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, published_at=excluded.published_at, data=excluded.data")
    .run(post.id, post.ownerId, post.status, post.createdAt, post.publishedAt, JSON.stringify(post));
}
function putAsset(asset: Asset) {
  db().prepare("INSERT INTO assets VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET post_id=excluded.post_id, upload_id=excluded.upload_id, mux_asset_id=excluded.mux_asset_id, data=excluded.data")
    .run(asset.id, asset.ownerId, asset.postId, asset.uploadId, asset.muxAssetId, JSON.stringify(asset));
}
function getPost(id: string) { return unpack<StoredPost>(db().prepare("SELECT data FROM posts WHERE id=?").get(id)); }
function getAsset(id: string) { return unpack<Asset>(db().prepare("SELECT data FROM assets WHERE id=?").get(id)); }
function appreciations(id: string, guest: string | null) {
  const count = (db().prepare("SELECT count(*) AS n FROM appreciations WHERE post_id=?").get(id) as { n: number }).n;
  const active = guest ? Boolean(db().prepare("SELECT 1 FROM appreciations WHERE post_id=? AND guest_id=?").get(id, guest)) : false;
  return { count, active };
}
export const localStore: Store = {
  async listPosts(query: PostQuery) {
    let rows = db().prepare("SELECT data FROM posts ORDER BY COALESCE(published_at,created_at) DESC, id DESC").all().map(row => unpack<StoredPost>(row)!);
    rows = rows.filter(p => query.scope === "feed" ? p.status === "approved" : query.scope === "mine" ? p.ownerId === query.ownerId : true);
    if (query.status) rows = rows.filter(p => p.status === query.status);
    if (query.kind) rows = rows.filter(p => p.kind === query.kind);
    if (query.search) { const text = query.search.toLocaleLowerCase("id"); rows = rows.filter(p => `${p.title} ${p.body} ${p.subject}`.toLocaleLowerCase("id").includes(text)); }
    return rows.slice(query.offset ?? 0, (query.offset ?? 0) + 21);
  },
  async getPost(id) { return getPost(id); },
  async submit(post, assetIds) {
    transaction(() => {
      const existing = getPost(post.id);
      if (existing && (existing.ownerId !== post.ownerId || existing.status === "pending" || existing.revision + 1 !== post.revision)) throw new AppError("Kiriman sedang direview atau sudah berubah.", 409);
      const assets = assetIds.map(id => getAsset(id));
      if (new Set(assetIds).size !== assetIds.length || assets.some(a => !a || a.ownerId !== post.ownerId || (a.postId && a.postId !== post.id) || a.status === "failed")) throw new AppError("Unggahan tidak tersedia.", 409);
      if (assets.some(a => post.kind === "photo" ? !a!.mime.startsWith("image/") : !a!.mime.startsWith("video/"))) throw new AppError("Jenis unggahan tidak cocok.");
      const old = db().prepare("SELECT data FROM assets WHERE post_id=?").all(post.id).map(a => unpack<Asset>(a)!);
      for (const a of old) if (!assetIds.includes(a.id)) putAsset({ ...a, postId: null });
      putPost({ ...post, status: "pending", publishedAt: null, reason: "" });
      for (const a of assets) putAsset({ ...a!, postId: post.id });
    });
  },
  async moderate(id, revision, status: PostStatus, reason) {
    transaction(() => {
      const post = getPost(id);
      if (!post) throw new AppError("Kiriman tidak ditemukan.", 404);
      if (post.revision !== revision) throw new AppError("Kiriman berubah. Muat ulang sebelum review.", 409);
      if (["approved", "rejected"].includes(status) && post.status !== "pending") throw new AppError("Kiriman sudah direview.", 409);
      const assets = db().prepare("SELECT data FROM assets WHERE post_id=?").all(id).map(a => unpack<Asset>(a)!);
      if (status === "approved" && assets.some(a => a.status !== "ready")) throw new AppError("Video belum selesai diproses.", 409);
      const now = new Date().toISOString();
      putPost({ ...post, status, reason, publishedAt: status === "approved" ? now : null });
      db().prepare("INSERT INTO moderation_events VALUES (?,?,?,?,?)").run(randomUUID(), id, status, reason, now);
    });
  },
  async getAsset(id) { return getAsset(id); },
  async assetsForPost(id) { return db().prepare("SELECT data FROM assets WHERE post_id=? ORDER BY rowid").all(id).map(row => unpack<Asset>(row)!); },
  async saveAsset(asset) { putAsset(asset); },
  async assetByUpload(id) { return unpack<Asset>(db().prepare("SELECT data FROM assets WHERE upload_id=?").get(id)); },
  async assetByMux(id) { return unpack<Asset>(db().prepare("SELECT data FROM assets WHERE mux_asset_id=?").get(id)); },
  async removeAsset(id) { db().prepare("DELETE FROM assets WHERE id=? AND post_id IS NULL").run(id); },
  async appreciation(id, guest) { return appreciations(id, guest); },
  async toggleAppreciation(id, guest) {
    return transaction(() => {
      if (getPost(id)?.status !== "approved") throw new AppError("Kiriman belum terbit.", 404);
      if (appreciations(id, guest).active) db().prepare("DELETE FROM appreciations WHERE post_id=? AND guest_id=?").run(id, guest);
      else db().prepare("INSERT INTO appreciations VALUES (?,?)").run(id, guest);
      return appreciations(id, guest);
    });
  },
  async report(id, guest, reason) { db().prepare("INSERT INTO reports VALUES (?,?,?,?) ON CONFLICT(post_id,guest_id) DO UPDATE SET reason=excluded.reason").run(id, guest, reason, new Date().toISOString()); },
  async reportCount(id) { return (db().prepare("SELECT count(*) AS n FROM reports WHERE post_id=?").get(id) as { n: number }).n; },
  async consumeLimit(key, max, windowMs) {
    return transaction(() => {
      const now = Date.now();
      db().prepare("DELETE FROM rate_limits WHERE reset_at<?").run(now);
      db().prepare("INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(key, now + windowMs);
      return (db().prepare("SELECT count FROM rate_limits WHERE key=?").get(key) as { count: number }).count <= max;
    });
  },
};
