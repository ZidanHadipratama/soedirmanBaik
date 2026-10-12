import type { FullDemo } from "./demo-content";
import type { FeedPost, Room, ThreadPart, Reply, ThreadDetail } from "./preview-types";
import { PREVIEW_SOCIAL_CHANGED } from "./preview-types";
import { moderationSchema } from "./validation";
import { reasonSchema, replySchema, roomSchema, socialContextSchema, storyText } from "./social-validation";

type StoredReply = Omit<Reply, "author" | "replyingTo" | "owned" | "reported"> & { actor: string; targetId: string | null; reporters: Map<string, string> };
export function createSocialPreview(posts: FeedPost[], mine: Set<string>, isAdmin: () => boolean, emit: (post: FeedPost) => void, seed?: FullDemo) {
  const rules = "Bahas kegiatan positif. Hormati orang lain dan jaga privasi.";
  const rooms: Room[] = [
    { id: "umum", slug: "umum", name: "Umum", description: "Cerita dan percakapan baik untuk semua.", rules, following: false, postCount: 0 },
    { id: "relawan", slug: "relawan", name: "Relawan", description: "Ajakan membantu dan kabar kegiatan bersama.", rules, following: false, postCount: 0 },
    { id: "belajar-bareng", slug: "belajar-bareng", name: "Belajar Bareng", description: "Berbagi ilmu, buku, dan teman belajar.", rules, following: false, postCount: 0 },
    { id: "lingkungan", slug: "lingkungan", name: "Lingkungan", description: "Langkah kecil untuk lingkungan yang lebih nyaman.", rules, following: false, postCount: 0 },
    { id: "ide-kampus", slug: "ide-kampus", name: "Ide Kampus", description: "Pertanyaan dan ide untuk kegiatan positif di kampus.", rules, following: false, postCount: 0 },
  ];
  const roomIds = new Map<string, string>();
  const parts = new Map<string, ThreadPart[]>();
  const replies: StoredReply[] = [];
  const aliases = new Map<string, Map<string, string>>();
  const saved = new Set<string>(); const locked = new Set<string>();
  for (const post of posts) {
    roomIds.set(post.id, post.id.includes("cleanup") || post.id === "demo-short" ? "lingkungan" : /books|study|article|thread/.test(post.id) ? "belajar-bareng" : post.kind === "poll" || post.kind === "photo" ? "relawan" : post.kind === "link" ? "ide-kampus" : "umum");
    parts.set(post.id, []);
  }
  function general() { if (typeof window !== "undefined") window.dispatchEvent(new Event(PREVIEW_SOCIAL_CHANGED)); }
  function admin() { if (!isAdmin()) throw new Error("Masuk sebagai admin."); }
  function root(id: string, access: "read" | "public" | "owner" = "read") {
    const post = posts.find(value => value.id === id);
    if (!post || (access === "public" ? post.status !== "approved" : access === "owner" ? !mine.has(id) : post.status !== "approved" && !mine.has(id) && !isAdmin())) throw new Error("Diskusi tidak tersedia.");
    return post;
  }
  function actor(postId: string) { return mine.has(postId) ? "writer" : "viewer"; }
  function alias(postId: string, key: string) {
    if (key === "writer") return "Penulis";
    let values = aliases.get(postId); if (!values) { values = new Map(); aliases.set(postId, values); }
    if (!values.has(key)) values.set(key, `Anonim ${String.fromCharCode(65 + values.size)}`);
    return values.get(key)!;
  }
  function replyView(reply: StoredReply): Reply {
    const target = replies.find(value => value.id === reply.targetId);
    return { id: reply.id, postId: reply.postId, parentId: reply.parentId, body: reply.deleted ? "" : reply.body,
      author: reply.deleted ? "Anonim" : alias(reply.postId, reply.actor), replyingTo: target ? alias(target.postId, target.actor) : null,
      owned: reply.actor === actor(reply.postId), deleted: reply.deleted, reported: reply.reporters.has(actor(reply.postId)),
      ...(isAdmin() ? { reports: reply.reporters.size, reportReasons: [...reply.reporters.values()] } : {}), createdAt: reply.createdAt };
  }
  function visibleParts(post: FeedPost) {
    const privateAccess = mine.has(post.id) || isAdmin();
    return (parts.get(post.id) ?? []).filter(part => privateAccess || part.status === "approved").map(part => ({ ...part, reason: privateAccess ? part.reason : "" }));
  }
  function project(post: FeedPost): FeedPost {
    const room = rooms.find(value => value.id === roomIds.get(post.id)) ?? rooms[0];
    const owned = mine.has(post.id); const privateAccess = owned || isAdmin();
    return { ...post, reason: privateAccess ? post.reason : "", reports: isAdmin() ? post.reports : undefined, social: {
      room: { id: room.id, slug: room.slug, name: room.name }, saved: saved.has(post.id), locked: locked.has(post.id), owned,
      replyCount: replies.filter(reply => reply.postId === post.id && !reply.deleted).length,
      partCount: 1 + (parts.get(post.id) ?? []).filter(part => part.status === "approved").length,
      parts: visibleParts(post), hasPendingParts: privateAccess && (parts.get(post.id) ?? []).some(part => part.status === "pending"),
    } };
  }
  function detail(post: FeedPost): ThreadDetail { return { post: project(post), parts: visibleParts(post), replies: replies.filter(reply => reply.postId === post.id).map(replyView), owned: mine.has(post.id), admin: isAdmin() }; }
  function roomList() { return rooms.map(room => ({ ...room, postCount: posts.filter(post => post.status === "approved" && roomIds.get(post.id) === room.id).length })); }
  function context(input: unknown) {
    const data = socialContextSchema.parse(input);
    if (!rooms.some(room => room.id === data.roomId)) throw new Error("Ruang tidak ditemukan.");
    return data;
  }
  function configure(post: FeedPost, data: ReturnType<typeof context>) {
    roomIds.set(post.id, data.roomId);
    const old = parts.get(post.id) ?? [];
    parts.set(post.id, data.parts.map((body, index) => ({ id: old[index]?.id ?? crypto.randomUUID(), postId: post.id, body, status: "pending", reason: "", revision: (old[index]?.revision ?? 0) + 1, createdAt: old[index]?.createdAt ?? new Date().toISOString(), initial: true })));
  }
  function reviewed(post: FeedPost) {
    for (const part of parts.get(post.id) ?? []) if (part.initial) { part.status = post.status; part.reason = post.reason; part.revision++; }
    emit(post);
  }
  function matches(post: FeedPost, url: URL) {
    const scope = url.searchParams.get("scope");
    return (!url.searchParams.get("roomId") || roomIds.get(post.id) === url.searchParams.get("roomId")) &&
      (url.searchParams.get("following") !== "true" || rooms.some(room => room.following && room.id === roomIds.get(post.id))) &&
      (scope !== "saved" || saved.has(post.id));
  }
  function open(post: FeedPost) { if (locked.has(post.id)) throw new Error("Diskusi dikunci. Kontribusi baru tidak tersedia."); }
  function handle(url: URL, method: string, input: unknown): unknown {
    const path = url.pathname; const fields = input && typeof input === "object" ? input as Record<string, unknown> : {};
    if (path === "/api/rooms" && method === "GET") return { rooms: roomList() };
    const roomAction = path.match(/^\/api\/(admin\/)?rooms(?:\/([^/]+))?(?:\/(follow))?$/);
    if (roomAction && method !== "GET") {
      if (roomAction[3] === "follow" && !roomAction[1] && method === "POST") {
        const room = rooms.find(value => value.id === roomAction[2]); if (!room) throw new Error("Ruang tidak ditemukan.");
        room.following = !room.following; general(); return { room: roomList().find(value => value.id === room.id) };
      }
      if (!roomAction[1] || !["POST", "PUT"].includes(method)) throw new Error("Aksi tidak tersedia.");
      admin(); const data = roomSchema.parse(input);
      const existing = roomAction[2] ? rooms.find(value => value.id === roomAction[2]) : undefined;
      if (roomAction[2] && !existing) throw new Error("Ruang tidak ditemukan.");
      if (rooms.some(room => room.id !== existing?.id && room.name.toLocaleLowerCase("id") === data.name.toLocaleLowerCase("id"))) throw new Error("Nama Ruang sudah digunakan.");
      if (existing) Object.assign(existing, data);
      else {
        const stem = data.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ruang";
        let slug = stem; let number = 2; while (rooms.some(room => room.slug === slug)) slug = `${stem}-${number++}`;
        rooms.push({ ...data, id: crypto.randomUUID(), slug, following: false, postCount: 0 });
      }
      general(); return { rooms: roomList() };
    }
    if (path === "/api/admin/parts" && method === "GET") {
      admin(); return { parts: posts.flatMap(post => (parts.get(post.id) ?? []).filter(part => !part.initial && part.status === "pending").map(part => ({ post: project(post), part: { ...part } }))) };
    }
    if (path === "/api/admin/replies" && method === "GET") {
      admin(); return { replies: replies.filter(reply => !reply.deleted && reply.reporters.size).map(reply => ({ post: project(root(reply.postId)), reply: replyView(reply) })) };
    }
    if (path === "/api/replies" && method === "GET") return { replies: replies.filter(reply => reply.actor === actor(reply.postId)).map(reply => {
      const post = posts.find(value => value.id === reply.postId)!; const accessible = post.status === "approved" || mine.has(post.id);
      return { ...replyView(reply), accessible, postTitle: accessible ? post.title || post.body.slice(0, 80) : "Diskusi tidak tersedia" };
    }) };
    const replyAction = path.match(/^\/api\/(admin\/)?replies\/([^/]+)(?:\/(report))?$/);
    if (replyAction) {
      const reply = replies.find(value => value.id === replyAction[2]); if (!reply) throw new Error("Balasan tidak ditemukan.");
      const post = posts.find(value => value.id === reply.postId)!;
      if (replyAction[3] === "report" && method === "POST" && !replyAction[1]) {
        root(post.id, "public"); if (reply.deleted) throw new Error("Balasan telah dihapus."); const report = reasonSchema.parse(input);
        reply.reporters.set(actor(post.id), report.reason); emit(post); return { ok: true };
      }
      if (method !== "DELETE") throw new Error("Aksi tidak tersedia.");
      if (replyAction[1]) { admin(); reasonSchema.parse(input); }
      else if (reply.actor !== actor(post.id)) throw new Error("Hanya pengirim yang dapat menghapus balasan.");
      reply.deleted = true; reply.body = ""; emit(post); return { ok: true };
    }
    const action = path.match(/^\/api\/(admin\/)?posts\/([^/]+)\/(thread|parts|replies|lock|save)(?:\/([^/]+))?$/);
    if (!action) return undefined;
    const [, privileged, postId, operation, partId] = action;
    if (operation === "thread" && method === "GET" && !privileged) return detail(root(postId));
    if (operation === "save" && method === "POST" && !privileged) {
      const post = root(postId, "public"); if (saved.has(postId)) saved.delete(postId); else saved.add(postId); emit(post); return { post: project(post) };
    }
    if (operation === "lock" && method === "POST" && privileged) {
      admin(); const post = root(postId, "public"); if (typeof fields.locked !== "boolean") throw new Error("Status kunci tidak valid.");
      if (fields.locked) locked.add(postId); else locked.delete(postId); emit(post); return { post: project(post) };
    }
    if (operation === "replies" && method === "POST" && !privileged) {
      const post = root(postId, "public"); open(post); const data = replySchema.parse(input);
      const target = data.parentId ? replies.find(value => value.id === data.parentId && value.postId === postId && !value.deleted) : null;
      if (data.parentId && !target) throw new Error("Balasan tujuan tidak tersedia.");
      const reply: StoredReply = { id: crypto.randomUUID(), postId, body: data.body, parentId: target ? target.parentId ?? target.id : null,
        actor: actor(postId), targetId: target?.id ?? null, deleted: false, createdAt: new Date().toISOString(), reporters: new Map() };
      alias(postId, reply.actor); replies.push(reply); emit(post); return { reply: replyView(reply), post: project(post) };
    }
    if (operation === "parts") {
      if (privileged) {
        admin(); const post = root(postId); const part = parts.get(postId)?.find(value => value.id === partId); if (!part || part.initial) throw new Error("Lanjutan tidak ditemukan.");
        if (method !== "POST") throw new Error("Aksi tidak tersedia.");
        const review = moderationSchema.parse(input); if (fields.revision !== part.revision) throw new Error("Lanjutan telah berubah.");
        if (review.action === "approve" && post.status !== "approved") throw new Error("Kiriman utama belum terbit.");
        part.status = review.action === "approve" ? "approved" : review.action === "hide" ? "hidden" : "rejected";
        part.reason = review.reason; part.revision++; emit(post); return { part: { ...part } };
      }
      const post = root(postId, "owner"); if (post.status !== "approved") throw new Error("Kiriman utama belum terbit."); open(post);
      const body = storyText.parse(fields.body); const values = parts.get(postId) ?? [];
      if (method === "PUT" && partId) {
        const part = values.find(value => value.id === partId); if (!part || part.status !== "rejected") throw new Error("Lanjutan ini tidak dapat diedit.");
        part.body = body; part.status = "pending"; part.reason = ""; part.revision++;
      } else if (method === "POST" && !partId) {
        if (values.length >= 4) throw new Error("Thread maksimal 5 bagian.");
        values.push({ id: crypto.randomUUID(), postId, body, status: "pending", reason: "", revision: 1, createdAt: new Date().toISOString(), initial: false }); parts.set(postId, values);
      } else throw new Error("Aksi tidak tersedia.");
      emit(post); return { parts: visibleParts(post) };
    }
    throw new Error("Aksi tidak tersedia.");
  }
  if (posts.some(post => post.id === "demo-thread")) {
    const timestamp = new Date(Date.now() - 600000).toISOString();
    parts.set("demo-thread", [{ id: "demo-thread-part", postId: "demo-thread", body: "Kita mulai dari mengumpulkan buku yang masih layak dibaca, lalu memilahnya bersama sebelum dibagikan.", status: "approved", reason: "", revision: 1, createdAt: timestamp, initial: true }]);
    replies.push(
      { id: "demo-reply-a", postId: "demo-thread", parentId: null, actor: "guest-a", targetId: null, body: "Aku bisa bantu memilah bukunya. Kapan kita mulai?", deleted: false, reporters: new Map(), createdAt: timestamp },
      { id: "demo-reply-writer", postId: "demo-thread", parentId: "demo-reply-a", actor: "writer", targetId: "demo-reply-a", body: "Terima kasih! Kita bisa mulai Sabtu pagi.", deleted: false, reporters: new Map(), createdAt: timestamp },
      { id: "demo-reply-b", postId: "demo-thread", parentId: null, actor: "guest-b", targetId: null, body: "Ada beberapa buku cerita yang bisa kusumbangkan.", deleted: false, reporters: new Map(), createdAt: timestamp },
    );
    for (const reply of replies) alias(reply.postId, reply.actor);
  }
  if (seed) {
    for (const [id, roomId] of Object.entries(seed.roomIds)) roomIds.set(id, roomId);
    for (const [id, values] of Object.entries(seed.parts)) parts.set(id, values);
    for (const value of seed.replies) {
      const { reportReason, ...reply } = value;
      replies.push({ ...reply, reporters: reportReason ? new Map([["sample-reporter", reportReason]]) : new Map() });
      alias(reply.postId, reply.actor);
    }
    for (const id of seed.saved) saved.add(id);
    for (const id of seed.locked) locked.add(id);
    for (const room of rooms) room.following = seed.followed.includes(room.id);
  }
  return { context, configure, reviewed, matches, project, handle };
}
