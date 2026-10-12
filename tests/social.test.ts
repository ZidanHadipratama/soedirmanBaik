import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewApi } from "../src/lib/ui-preview";
import { createSocialPreview } from "../src/lib/social-preview";
import { shortSubmissionSchema, socialContextSchema } from "../src/lib/social-validation";
import { submissionSchema } from "../src/lib/validation";
import { safeBackLink } from "../src/lib/utils";
import type { FeedPost, Room, Reply, ThreadDetail, PartReview, ReportedReply } from "../src/lib/preview-types";

const story = { kind: "short", body: "Mari berbagi buku untuk teman-teman.", roomId: "belajar-bareng", parts: ["Kumpulkan buku yang masih layak dibaca.", "Kita akan memilahnya bersama Sabtu pagi."] };
async function setup() {
  const api = createPreviewApi();
  const send = <T>(url: string, data: unknown, method = "POST") => api<T>(url, { method, body: JSON.stringify(data) });
  const { post } = await send<{ post: FeedPost }>("/api/posts", story);
  const login = () => send("/api/admin/login", {});
  const approve = async () => { await login(); return send(`/api/admin/posts/${post.id}`, { action: "approve", revision: post.revision }); };
  const detail = () => api<ThreadDetail>(`/api/posts/${post.id}/thread`);
  return { api, send, post, login, approve, detail };
}
function fixture() {
  const post: FeedPost = { id: "fixture", kind: "short", title: "", body: "Cerita utama.", subject: "", url: "", assets: [], status: "approved", revision: 1, createdAt: new Date().toISOString(), publishedAt: new Date().toISOString(), reason: "", example: true, appreciated: false, appreciations: 0 };
  const posts = [post]; const mine = new Set([post.id]); let administrator = false;
  const social = createSocialPreview(posts, mine, () => administrator, () => {});
  const call = <T>(path: string, data: unknown = {}, method = "POST") => social.handle(new URL(path, "https://demo.invalid"), method, data) as T;
  return { post, posts, mine, social, call, admin: (value: boolean) => { administrator = value; } };
}

test("social validation bounds text and thread length without extending production contracts", () => {
  assert.equal(shortSubmissionSchema.parse({ kind: "short", body: "  Cerita baik.  " }).body, "Cerita baik.");
  assert.equal(shortSubmissionSchema.safeParse({ kind: "short", body: "a".repeat(501) }).success, false);
  assert.equal(shortSubmissionSchema.safeParse({ kind: "short", body: "   " }).success, false);
  assert.equal(socialContextSchema.safeParse({ parts: Array(5).fill("Lanjutan.") }).success, false);
  assert.equal(submissionSchema.safeParse(story).success, false);
});

test("rooms are curated, followable, and editable only by admin; names and slugs remain safe", async () => {
  const { api, send, login } = await setup();
  const initial = await api<{ rooms: Room[] }>("/api/rooms"); assert.equal(initial.rooms.length, 5);
  assert.ok(initial.rooms.every(room => !room.following));
  await assert.rejects(send("/api/admin/rooms", { name: "Kegiatan Baru", description: "Kegiatan bersama.", rules: "Saling menghormati." }), /admin/);
  await send("/api/rooms/relawan/follow", {});
  assert.equal((await api<{ rooms: Room[] }>("/api/rooms")).rooms.find(room => room.id === "relawan")!.following, true);
  await login();
  const created = await send<{ rooms: Room[] }>("/api/admin/rooms", { name: "Kegiatan Baru", description: "Kegiatan bersama.", rules: "Saling menghormati." });
  const room = created.rooms.find(room => room.name === "Kegiatan Baru")!; assert.equal(room.slug, "kegiatan-baru");
  await assert.rejects(send("/api/admin/rooms", { name: " kegiatan BARU ", description: "Kegiatan bersama.", rules: "Saling menghormati." }), /sudah digunakan/);
  const updated = await send<{ rooms: Room[] }>(`/api/admin/rooms/${room.id}`, { name: "Relawan Baru", description: "Kegiatan bersama.", rules: "Saling menghormati." }, "PUT");
  assert.equal(updated.rooms.find(value => value.id === room.id)!.slug, room.slug);
});

test("initial thread parts are approved as a package and only roots enter the feed", async () => {
  const { api, post, approve, detail } = await setup();
  assert.equal(post.status, "pending"); assert.equal((await detail()).parts.length, 2);
  assert.ok((await detail()).parts.every(part => part.status === "pending"));
  assert.ok(!(await api<{ posts: FeedPost[] }>("/api/posts?scope=feed")).posts.some(value => value.id === post.id));
  await approve(); const published = await detail();
  assert.equal(published.post.social!.partCount, 3); assert.ok(published.parts.every(part => part.status === "approved"));
  const feed = await api<{ posts: FeedPost[] }>("/api/posts?scope=feed&roomId=belajar-bareng");
  assert.equal(feed.posts.filter(value => value.id === post.id).length, 1);
  assert.ok(feed.posts.every(value => value.social?.room.id === "belajar-bareng"));
});

test("pending parts, moderation notes, and internal actor identities are absent from public projections", () => {
  const { call, mine, post, social, admin } = fixture();
  call(`/api/posts/${post.id}/parts`, { body: "Lanjutan privat." });
  const owned = call<ThreadDetail>(`/api/posts/${post.id}/thread`, {}, "GET"); assert.equal(owned.parts.length, 1);
  mine.clear(); const publicThread = call<ThreadDetail>(`/api/posts/${post.id}/thread`, {}, "GET");
  assert.equal(publicThread.parts.length, 0); assert.equal(publicThread.post.social!.hasPendingParts, false);
  assert.ok(!JSON.stringify(publicThread).includes("Lanjutan privat"));
  const reply = call<{ reply: Reply }>(`/api/posts/${post.id}/replies`, { body: "Saya ikut membantu.", author: "Nama asli", owned: true }).reply;
  assert.equal(reply.author, "Anonim A"); assert.ok(!JSON.stringify(reply).includes('"actor"'));
  call(`/api/replies/${reply.id}/report`, { reason: "Catatan privat laporan." });
  assert.ok(!JSON.stringify(social.project(post)).includes("Catatan privat"));
  admin(true); const reports = call<{ replies: ReportedReply[] }>("/api/admin/replies", {}, "GET");
  assert.deepEqual(reports.replies[0].reply.reportReasons, ["Catatan privat laporan."]);
});

test("later parts retain published content while awaiting independent review, correction, and stale guards", async () => {
  const { send, api, post, approve, detail } = await setup(); await approve();
  await send(`/api/posts/${post.id}/parts`, { body: "Lanjutan baru untuk kegiatan." });
  let current = await detail(); assert.equal(current.post.status, "approved"); assert.equal(current.post.social!.partCount, 3);
  const pending = current.parts.find(part => !part.initial)!;
  await assert.rejects(send(`/api/posts/${post.id}`, story, "PUT"), /tidak dapat diedit/);
  await send(`/api/admin/posts/${post.id}/parts/${pending.id}`, { action: "reject", reason: "Tambahkan konteks.", revision: pending.revision });
  await send(`/api/posts/${post.id}/parts/${pending.id}`, { body: "Lanjutan kegiatan dan konteks yang lengkap." }, "PUT");
  await assert.rejects(send(`/api/admin/posts/${post.id}/parts/${pending.id}`, { action: "approve", revision: pending.revision }), /berubah/);
  const queue = await api<{ parts: PartReview[] }>("/api/admin/parts");
  const updated = queue.parts.find(value => value.part.id === pending.id)!.part;
  await send(`/api/admin/posts/${post.id}/parts/${pending.id}`, { action: "approve", revision: updated.revision });
  current = await detail(); assert.equal(current.post.social!.partCount, 4);
});

test("part capacity and ownership are enforced even for admin sessions", () => {
  const { call, post, mine, admin } = fixture();
  for (let i = 0; i < 4; i++) call(`/api/posts/${post.id}/parts`, { body: `Lanjutan ke ${i}.` });
  assert.throws(() => call(`/api/posts/${post.id}/parts`, { body: "Bagian keenam." }), /maksimal 5/);
  mine.clear(); admin(true);
  assert.throws(() => call(`/api/posts/${post.id}/parts`, { body: "Mengaku sebagai penulis." }), /tidak tersedia/);
});

test("replies publish immediately, flatten deeper nesting, preserve placeholders, and keep aliases stable", () => {
  const { call, post, mine } = fixture();
  const a = call<{ reply: Reply }>(`/api/posts/${post.id}/replies`, { body: "Balasan penulis." }).reply; assert.equal(a.author, "Penulis");
  mine.clear();
  const b = call<{ reply: Reply }>(`/api/posts/${post.id}/replies`, { body: "Balasan pembaca.", parentId: a.id }).reply;
  const c = call<{ reply: Reply }>(`/api/posts/${post.id}/replies`, { body: "Balasan lanjutan pembaca.", parentId: b.id }).reply;
  assert.equal(b.parentId, a.id); assert.equal(c.parentId, a.id); assert.equal(c.replyingTo, b.author); assert.equal(c.author, b.author);
  assert.throws(() => call(`/api/replies/${a.id}`, {}, "DELETE"), /Hanya pengirim/);
  mine.add(post.id); call(`/api/replies/${a.id}`, {}, "DELETE");
  const thread = call<ThreadDetail>(`/api/posts/${post.id}/thread`, {}, "GET");
  assert.equal(thread.replies[0].deleted, true); assert.equal(thread.replies[0].body, ""); assert.equal(thread.replies.length, 3);
  assert.equal(thread.replies[1].author, b.author); assert.equal(thread.post.social!.replyCount, 2);
});

test("cross-thread reply targets and invalid text are rejected atomically", async () => {
  const { send, post, approve, detail } = await setup(); await approve();
  await assert.rejects(send(`/api/posts/${post.id}/replies`, { body: "Balasan salah thread.", parentId: "demo-reply-a" }), /tujuan/);
  await assert.rejects(send(`/api/posts/${post.id}/replies`, { body: " " }));
  await assert.rejects(send(`/api/posts/${post.id}/replies`, { body: "x".repeat(501) }));
  assert.equal((await detail()).replies.length, 0);
});

test("reports are deduplicated and admin removal keeps descendant replies", () => {
  const { call, mine, post, admin } = fixture();
  const parent = call<{ reply: Reply }>(`/api/posts/${post.id}/replies`, { body: "Balasan awal." }).reply;
  mine.clear(); const child = call<{ reply: Reply }>(`/api/posts/${post.id}/replies`, { body: "Tanggapan pembaca.", parentId: parent.id }).reply;
  call(`/api/replies/${parent.id}/report`, { reason: "Periksa konteks." }); call(`/api/replies/${parent.id}/report`, { reason: "Periksa konteks lagi." });
  assert.throws(() => call("/api/admin/replies", {}, "GET"), /admin/);
  admin(true); assert.equal(call<{ replies: ReportedReply[] }>("/api/admin/replies", {}, "GET").replies[0].reply.reports, 1);
  call(`/api/admin/replies/${parent.id}`, { reason: "Tidak sesuai aturan." }, "DELETE");
  const thread = call<ThreadDetail>(`/api/posts/${post.id}/thread`, {}, "GET");
  assert.equal(thread.replies[0].body, ""); assert.equal(thread.replies[1].id, child.id);
});

test("discussion locking is admin-only and independent of poll voting", async () => {
  const { api, send, login } = await setup();
  await assert.rejects(send("/api/admin/posts/demo-poll-single/lock", { locked: true }), /admin/);
  await login(); await send("/api/admin/posts/demo-poll-single/lock", { locked: true });
  await assert.rejects(send("/api/posts/demo-poll-single/replies", { body: "Balasan baru." }), /dikunci/);
  const poll = await api<FeedPost>("/api/posts/demo-poll-single"); assert.equal(poll.kind, "poll");
  if (poll.kind !== "poll") throw new Error("Expected poll");
  await send("/api/posts/demo-poll-single/vote", { optionIds: [poll.poll.options[0].id] });
  await send("/api/admin/posts/demo-poll-single/lock", { locked: false });
  await send("/api/posts/demo-poll-single/replies", { body: "Balasan setelah dibuka." });
});

test("root edits and hiding revoke access to the entire thread for public viewers", () => {
  const { call, post, mine } = fixture();
  call(`/api/posts/${post.id}/replies`, { body: "Percakapan yang sudah ada." });
  post.status = "pending"; mine.clear(); assert.throws(() => call(`/api/posts/${post.id}/thread`, {}, "GET"), /tidak tersedia/);
  assert.throws(() => call(`/api/posts/${post.id}/replies`, { body: "Balasan pada draft." }), /tidak tersedia/);
  post.status = "hidden"; assert.throws(() => call(`/api/posts/${post.id}/thread`, {}, "GET"), /tidak tersedia/);
});

test("saved and followed projections agree across views and new sessions reset", async () => {
  const { api, send } = await setup();
  await send("/api/posts/demo-thread/save", {});
  const saved = await api<{ posts: FeedPost[] }>("/api/posts?scope=saved"); assert.deepEqual(saved.posts.map(post => post.id), ["demo-thread"]);
  await send("/api/rooms/belajar-bareng/follow", {});
  const followed = await api<{ posts: FeedPost[] }>("/api/posts?scope=feed&following=true"); assert.ok(followed.posts.every(post => post.social!.room.id === "belajar-bareng"));
  await send("/api/posts/demo-thread/save", {}); assert.equal((await api<{ posts: FeedPost[] }>("/api/posts?scope=saved")).posts.length, 0);
  assert.equal((await createPreviewApi()<{ rooms: Room[] }>("/api/rooms")).rooms.filter(room => room.following).length, 0);
});

test("deep-link back targets remain inside the application", () => {
  assert.equal(safeBackLink("/ruang?slug=relawan"), "/ruang?slug=relawan");
  for (const value of ["//evil.example", "/\\evil.example", "javascript:alert(1)", "https://evil.example", "/unknown"]) assert.equal(safeBackLink(value), "/");
});
