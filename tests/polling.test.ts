import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewApi } from "../src/lib/ui-preview";
import { pollSubmissionSchema } from "../src/lib/poll-validation";
import { canEditPost, type PollPost, type PollSubmission, type FeedPost } from "../src/lib/preview-types";
import { POST_KINDS } from "../src/lib/types";
import { submissionSchema } from "../src/lib/validation";

function input(multiple = false): PollSubmission {
  return { kind: "poll", title: "Kegiatan sosial berikutnya?", body: "", subject: "", url: "", assetIds: [], poll: { multiple, options: ["Donor darah", "Bersih lingkungan", "Penggalangan buku"].map(label => ({ id: crypto.randomUUID(), label })) } };
}
async function setup(multiple = false) {
  const api = createPreviewApi(); const submission = input(multiple);
  const { post } = await api<{ post: PollPost }>("/api/posts", { method: "POST", body: JSON.stringify(submission) });
  const send = (path: string, data: unknown, method = "POST") => api<{ post: PollPost }>(path, { method, body: JSON.stringify(data) });
  const approve = async () => {
    await send("/api/admin/login", {});
    return send(`/api/admin/posts/${post.id}`, { action: "approve", revision: post.revision });
  };
  const vote = (optionIds: string[]) => send(`/api/posts/${post.id}/vote`, { optionIds });
  return { api, submission, post, send, approve, vote };
}

test("poll validation trims input and rejects blanks, duplicates, limits, repeated IDs, and media", () => {
  const valid = input(); valid.title = "  Pertanyaan polling?  "; valid.poll.options[0].label = " Donor darah ";
  assert.equal(pollSubmissionSchema.parse(valid).title, "Pertanyaan polling?");
  assert.equal(pollSubmissionSchema.parse(valid).poll.options[0].label, "Donor darah");
  for (const mutate of [
    (v: PollSubmission) => { v.title = " "; },
    (v: PollSubmission) => { v.title = "x".repeat(161); },
    (v: PollSubmission) => { v.poll.options[0].label = " "; },
    (v: PollSubmission) => { v.poll.options[1].label = " DONOR DARAH "; },
    (v: PollSubmission) => { v.poll.options[1].id = v.poll.options[0].id; },
    (v: PollSubmission) => { v.poll.options[0].label = "x".repeat(101); },
    (v: PollSubmission) => { v.poll.options = v.poll.options.slice(0, 1); },
    (v: PollSubmission) => { v.poll.options = Array.from({ length: 13 }, (_, n) => ({ id: crypto.randomUUID(), label: `Pilihan ${n}` })); },
    (v: PollSubmission) => { v.assetIds = [crypto.randomUUID()]; },
    (v: PollSubmission) => { v.body = "x".repeat(2001); },
  ]) { const invalid = input(); mutate(invalid); assert.equal(pollSubmissionSchema.safeParse(invalid).success, false); }
});

test("preview polls do not extend the production submission interface", () => {
  assert.deepEqual(POST_KINDS, ["photo", "video", "article", "link"]);
  assert.equal(submissionSchema.safeParse(input()).success, false);
});

test("pending polls stay out of feed and reject voting, editing, and closing", async () => {
  const { api, post, submission, send, vote } = await setup();
  assert.equal(post.status, "pending"); assert.equal(post.poll.participants, 0);
  assert.equal(canEditPost(post), false);
  const { posts } = await api<{ posts: FeedPost[] }>("/api/posts?scope=feed&kind=poll");
  assert.ok(!posts.some(item => item.id === post.id));
  await assert.rejects(vote([post.poll.options[0].id]), /belum tersedia/);
  await assert.rejects(send(`/api/posts/${post.id}`, submission, "PUT"), /tidak dapat diedit/);
  await assert.rejects(send(`/api/posts/${post.id}/close`, {}), /belum tersedia/);
});

test("single-answer votes replace and withdraw without double-counting", async () => {
  const { post, approve, vote } = await setup(); await approve();
  const [a, b] = post.poll.options.map(option => option.id);
  let current = (await vote([a])).post;
  assert.equal(current.poll.participants, 1); assert.deepEqual(current.poll.options.map(v => v.votes), [1, 0, 0]);
  current = (await vote([a])).post;
  assert.equal(current.poll.participants, 1); assert.equal(current.poll.options[0].votes, 1);
  current = (await vote([b])).post;
  assert.equal(current.poll.participants, 1); assert.deepEqual(current.poll.options.map(v => v.votes), [0, 1, 0]);
  current = (await vote([])).post;
  assert.equal(current.poll.participants, 0); assert.deepEqual(current.poll.options.map(v => v.votes), [0, 0, 0]);
});

test("multiple selections count one participant and reject invalid ballots atomically", async () => {
  const { api, post, approve, vote } = await setup(true); await approve();
  const ids = post.poll.options.map(option => option.id);
  let current = (await vote(ids.slice(0, 2))).post;
  assert.equal(current.poll.participants, 1); assert.deepEqual(current.poll.options.map(v => v.votes), [1, 1, 0]);
  await assert.rejects(vote([ids[0], ids[0]])); await assert.rejects(vote([crypto.randomUUID()]));
  current = await api<PollPost>(`/api/posts/${post.id}`);
  assert.deepEqual(current.poll.ballot, ids.slice(0, 2));
  current = (await vote([ids[1]])).post; assert.equal(current.poll.participants, 1);
  current = (await vote([])).post; assert.equal(current.poll.participants, 0);
});

test("single-answer polls reject multiple options and non-polls reject ballots", async () => {
  const { post, approve, vote, send } = await setup(); await approve();
  await assert.rejects(vote(post.poll.options.slice(0, 2).map(v => v.id)), /tidak valid/);
  await assert.rejects(send("/api/posts/demo-article/vote", { optionIds: [] }), /belum tersedia/);
});

test("only creators close polls; closure preserves votes and permanently locks interaction", async () => {
  const { api, post, submission, send, approve, vote } = await setup(); await approve();
  await vote([post.poll.options[0].id]);
  await assert.rejects(send("/api/posts/demo-poll-single/close", {}), /Hanya pengirim/);
  let current = (await send(`/api/posts/${post.id}/close`, {})).post;
  assert.equal(current.poll.closed, true); assert.equal(current.poll.participants, 1); assert.equal(current.poll.options[0].votes, 1);
  assert.equal(canEditPost(current), false);
  await assert.rejects(vote([]), /ditutup/);
  await assert.rejects(send(`/api/posts/${post.id}`, submission, "PUT"), /tidak dapat diedit/);
  await send(`/api/posts/${post.id}/close`, {});
  current = await api<PollPost>(`/api/posts/${post.id}`);
  assert.equal(current.poll.participants, 1);
});

test("rejection allows correction; stale reviews and editing voted or closed polls are blocked", async () => {
  const { api, post, submission, send, approve, vote } = await setup();
  await send("/api/admin/login", {});
  await send(`/api/admin/posts/${post.id}`, { action: "reject", revision: 1, reason: "Tambahkan konteks." });
  const corrected = (await send(`/api/posts/${post.id}`, { ...submission, body: "Untuk kegiatan komunitas." }, "PUT")).post;
  assert.equal(corrected.status, "pending"); assert.equal(corrected.poll.participants, 0);
  await assert.rejects(approve(), /berubah/);
  await send(`/api/admin/posts/${post.id}`, { action: "approve", revision: corrected.revision });
  await vote([post.poll.options[0].id]);
  const voted = await api<PollPost>(`/api/posts/${post.id}`); assert.equal(canEditPost(voted), false);
  await assert.rejects(send(`/api/posts/${post.id}`, submission, "PUT"), /tidak dapat diedit/);
  await send(`/api/admin/posts/${post.id}`, { action: "hide", revision: voted.revision, reason: "Perlu ditinjau lagi." });
  await assert.rejects(vote([post.poll.options[1].id]), /belum tersedia/);
});

test("search, gallery/feed projections, and fresh preview sessions agree on ballot state", async () => {
  const { api, post, approve, vote } = await setup(); await approve();
  await vote([post.poll.options[0].id]);
  const { posts } = await api<{ posts: PollPost[] }>("/api/posts?scope=feed&kind=poll&q=kegiatan%20sosial");
  const found = posts.find(v => v.id === post.id)!;
  assert.equal(found.poll.participants, 1); assert.deepEqual(found.poll.ballot, [post.poll.options[0].id]);
  const fresh = createPreviewApi();
  await assert.rejects(fresh(`/api/posts/${post.id}`), /tidak ditemukan/);
  const seeded = await fresh<PollPost>("/api/posts/demo-poll-multiple");
  assert.equal(seeded.poll.participants, 6); assert.deepEqual(seeded.poll.ballot, []);
});
