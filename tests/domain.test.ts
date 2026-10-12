import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { localStore, db } from "../src/lib/server/store-local";
import { publicPost, submit } from "../src/lib/server/service";
import { signIdentity, readIdentity } from "../src/lib/server/auth";
import { safeWebsite, submissionSchema, validateVideo } from "../src/lib/validation";
import type { Asset } from "../src/lib/types";

const directory = mkdtempSync(`${tmpdir()}/soedirman-domain-`);
process.env.DATA_DIRECTORY = directory; process.env.DATA_BACKEND = "local";
after(() => { db().close(); rmSync(directory, { recursive: true, force: true }); });
const secret = "test-secret-with-at-least-thirty-two-characters";
const owner = randomUUID();
const article = { kind: "article", title: "Berbagi ilmu", body: "Membantu teman belajar bersama.", assetIds: [] };
async function photoAsset(actor = owner, status: Asset["status"] = "ready") {
  const asset: Asset = { id: randomUUID(), ownerId: actor, postId: null, provider: "local", path: "test.webp", mime: "image/webp", size: 128, status, uploadId: null, muxAssetId: null, playbackId: null, createdAt: new Date().toISOString() };
  await localStore.saveAsset(asset); return asset;
}
test("signed identities reject tampering, expiry, and role escalation", () => {
  const token = signIdentity({ id: owner, role: "guest", expires: Date.now() + 10000 }, secret);
  assert.equal(readIdentity(token, secret, "guest")?.id, owner);
  assert.equal(readIdentity(token, secret, "admin"), null);
  assert.equal(readIdentity(token + "x", secret, "guest"), null);
  assert.equal(readIdentity(token, "wrong-secret", "guest"), null);
  assert.equal(readIdentity(signIdentity({ id: owner, role: "guest", expires: 1 }, secret), secret, "guest"), null);
});
test("submission validation rejects executable links and enforces media requirements", () => {
  assert.equal(safeWebsite("javascript:alert(1)"), false);
  assert.equal(safeWebsite("https://user:password@example.com"), false);
  assert.equal(safeWebsite("https://example.com/project"), true);
  assert.equal(submissionSchema.safeParse({ kind: "photo", body: "Aksi baik" }).success, false);
  assert.equal(submissionSchema.safeParse({ kind: "article", body: "Aksi baik" }).success, false);
  assert.equal(submissionSchema.safeParse({ kind: "link", body: "Aksi baik", url: "data:text/html,bad" }).success, false);
  assert.equal(validateVideo(Buffer.from("not-a-video"), "video/mp4"), false);
});
test("client status fields cannot publish a post and anonymous projection excludes ownership", async () => {
  const post = await submit({ ...article, status: "approved", ownerId: randomUUID() }, owner);
  assert.equal(post.status, "pending");
  assert.equal((await localStore.listPosts({ scope: "feed" })).some(p => p.id === post.id), false);
  assert.equal((await localStore.getPost(post.id))?.ownerId, owner);
  const visible = await publicPost((await localStore.getPost(post.id))!, null);
  assert.equal("ownerId" in visible, false);
  const privateNote = { ...(await localStore.getPost(post.id))!, reason: "Catatan hanya untuk pengirim." };
  assert.equal((await publicPost(privateNote, null)).reason, "");
  assert.equal((await publicPost(privateNote, owner)).reason, privateNote.reason);
});
test("foreign assets, duplicate assets, and reused uploads are rejected atomically", async () => {
  const a = await photoAsset();
  await assert.rejects(submit({ kind: "photo", body: "Cerita baik", assetIds: [a.id] }, randomUUID()));
  await assert.rejects(submit({ kind: "photo", body: "Cerita baik", assetIds: [a.id, a.id] }, owner));
  assert.equal((await localStore.getAsset(a.id))?.postId, null);
  const post = await submit({ kind: "photo", body: "Cerita baik", assetIds: [a.id] }, owner);
  await assert.rejects(submit({ kind: "photo", body: "Cerita lain", assetIds: [a.id] }, owner));
  assert.equal((await localStore.getAsset(a.id))?.postId, post.id);
});
test("review locks content, detects stale revisions, and removes edited content from feed", async () => {
  const p = await submit(article, owner);
  await assert.rejects(submit({ ...article, body: "Konten diubah" }, owner, p.id));
  await localStore.moderate(p.id, 1, "rejected", "Tambahkan konteks.");
  const updated = await submit({ ...article, body: "Membantu teman dengan menjelaskan materi." }, owner, p.id);
  assert.equal(updated.revision, 2);
  await assert.rejects(localStore.moderate(p.id, 1, "approved", ""));
  await localStore.moderate(p.id, 2, "approved", "");
  assert.ok((await localStore.listPosts({ scope: "feed" })).some(p => p.id === updated.id));
  await submit({ ...article, body: "Cerita diperbarui dan perlu review lagi." }, owner, p.id);
  assert.equal((await localStore.listPosts({ scope: "feed" })).some(post => post.id === p.id), false);
});
test("unprocessed media cannot be approved and hiding a post revokes publication", async () => {
  const a = await photoAsset(owner, "processing");
  const post = await submit({ kind: "photo", body: "Cerita baik", assetIds: [a.id] }, owner);
  await assert.rejects(localStore.moderate(post.id, 1, "approved", ""));
  await localStore.saveAsset({ ...a, postId: post.id, status: "ready" });
  await localStore.moderate(post.id, 1, "approved", "");
  await localStore.moderate(post.id, 1, "hidden", "Privasi orang lain.");
  assert.equal((await localStore.getPost(post.id))?.status, "hidden");
  assert.equal((await localStore.listPosts({ scope: "feed" })).some(p => p.id === post.id), false);
});
test("appreciation is per guest, reversible, and disallowed for pending content", async () => {
  const p = await submit(article, owner); const other = randomUUID();
  await assert.rejects(localStore.toggleAppreciation(p.id, other));
  await localStore.moderate(p.id, 1, "approved", "");
  assert.deepEqual(await localStore.toggleAppreciation(p.id, other), { count: 1, active: true });
  assert.deepEqual(await localStore.toggleAppreciation(p.id, other), { count: 0, active: false });
});
test("rate limits count concurrent attempts and expire", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const key = randomUUID();
  const results = await Promise.all([localStore.consumeLimit(key, 2, 10), localStore.consumeLimit(key, 2, 10), localStore.consumeLimit(key, 2, 10)]);
  assert.deepEqual(results, [true, true, false]);
  now += 20;
  assert.equal(await localStore.consumeLimit(key, 2, 10), true);
});
