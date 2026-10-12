import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createPreviewApi } from "../src/lib/ui-preview";
import { createFullDemoContent } from "../src/lib/demo-content";
import type { FeedPost, Room, ThreadDetail, MyReply, PartReview, ReportedReply } from "../src/lib/preview-types";

test("full demo spans every format and room with readable fictional content and existing media", () => {
  const data = createFullDemoContent(Date.now());
  const publicPosts = data.posts.filter(post => post.status === "approved");
  assert.equal(publicPosts.length, 100); assert.equal(data.replies.length, 500);
  assert.deepEqual(new Set(publicPosts.map(post => post.kind)), new Set(["short", "photo", "article", "poll", "link", "video"]));
  for (const post of data.posts) {
    assert.equal(post.example, true); assert.ok(post.body.trim().length >= 3);
    if (post.kind === "short") assert.ok(post.body.length <= 500);
    for (const asset of post.assets) assert.ok(existsSync(`public${asset.url}`), asset.url);
    if (post.kind === "poll") {
      assert.ok(post.poll.options.every(option => option.votes >= 0 && option.votes <= post.poll.participants));
      if (!post.poll.multiple) assert.equal(post.poll.options.reduce((sum, option) => sum + option.votes, 0), post.poll.participants);
    }
  }
  assert.equal(new Set(Object.values(data.roomIds)).size, 5);
});

test("populated pagination returns all 112 approved roots exactly once and public data stays projected", async () => {
  const api = createPreviewApi({ full: true }); const seen = new Set<string>(); let offset = 0; let hasMore = true;
  while (hasMore) {
    const result = await api<{ posts: FeedPost[]; hasMore: boolean }>(`/api/posts?scope=feed&offset=${offset}`);
    assert.ok(result.posts.length <= 20); for (const post of result.posts) { assert.equal(post.status, "approved"); assert.ok(!seen.has(post.id)); seen.add(post.id); assert.equal(post.example, true); }
    offset += result.posts.length; hasMore = result.hasMore;
  }
  assert.equal(seen.size, 112);
  const { rooms } = await api<{ rooms: Room[] }>("/api/rooms"); assert.equal(rooms.reduce((sum, room) => sum + room.postCount, 0), 112);
  assert.ok(rooms.every(room => room.postCount >= 20)); assert.equal(rooms.filter(room => room.following).length, 2);
  const foreign = await api<ThreadDetail>("/api/posts/dense-lingkungan-2/thread");
  assert.ok(!JSON.stringify(foreign).includes('"actor"')); assert.ok(foreign.parts.every(part => part.status === "approved"));
});

test("personal and moderation surfaces are populated, mutation works, and reloading restores samples", async () => {
  const api = createPreviewApi({ full: true });
  const send = <T>(path: string, data: unknown, method = "POST") => api<T>(path, { method, body: JSON.stringify(data) });
  const saved = await api<{ posts: FeedPost[] }>("/api/posts?scope=saved"); assert.equal(saved.posts.length, 10);
  const mine = await api<{ posts: FeedPost[] }>("/api/posts?scope=mine"); assert.ok(mine.posts.some(post => post.status === "pending")); assert.ok(mine.posts.some(post => post.status === "rejected")); assert.ok(mine.posts.some(post => post.status === "hidden"));
  assert.ok((await api<{ replies: MyReply[] }>("/api/replies")).replies.length > 10);
  await send("/api/admin/login", {});
  assert.equal((await api<{ parts: PartReview[] }>("/api/admin/parts")).parts.length, 3);
  assert.equal((await api<{ replies: ReportedReply[] }>("/api/admin/replies")).replies.length, 5);
  await send(`/api/posts/${saved.posts[0].id}/save`, {});
  assert.equal((await api<{ posts: FeedPost[] }>("/api/posts?scope=saved")).posts.length, 9);
  const reset = createPreviewApi({ full: true }); assert.equal((await reset<{ posts: FeedPost[] }>("/api/posts?scope=saved")).posts.length, 10);
});
