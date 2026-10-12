import type { Post, PublicAsset, Submission } from "./types";
import { moderationSchema, submissionSchema } from "./validation";

// Browser-only demo data. This module never calls the production API.
const now = Date.now();
const base = { subject: "", title: "", body: "", url: "", reason: "", example: true, revision: 1, appreciations: 0, appreciated: false, assets: [] };
function example(id: string, values: Partial<Post>): Post {
  return { ...base, id, kind: "article", status: "approved", createdAt: new Date(now - 3600000).toISOString(), publishedAt: new Date(now - 3600000).toISOString(), ...values };
}
const posts: Post[] = [
  example("demo-photo", { kind: "photo", subject: "Teman-teman relawan", body: "Hadir, ikut membantu, dan pulang membawa cerita baik. Terima kasih untuk setiap teman yang meluangkan waktu menjadi relawan.", appreciations: 24, assets: [{ id: "demo-photo-asset", provider: "local", mime: "image/jpeg", status: "ready", playbackId: null, url: "/assets/community.jpg" }] }),
  example("demo-article", { title: "Berbagi ilmu, satu sore setiap minggu.", subject: "Teman-teman yang berbagi ilmu", body: "Tidak semua kebaikan harus dimulai dari hal besar. Kadang, cukup menyediakan waktu untuk **menemani seseorang belajar**.\n\n## Mulai dari satu sore\n\nDalam contoh cerita ini, beberapa teman membuka sesi belajar bersama.\n\n- Membawa buku untuk dibaca bersama.\n- Mendengarkan pertanyaan dengan sabar.\n- Menjelaskan kembali pelajaran yang belum dipahami.\n\n> Satu sore yang sederhana bisa membuat seseorang lebih percaya diri untuk mencoba lagi.", appreciations: 18 }),
  example("demo-link", { kind: "link", title: "Pengetahuan untuk siapa saja", body: "Contoh kontribusi: menulis dan memperbaiki artikel agar lebih banyak orang bisa belajar.", url: "https://www.wikipedia.org/", appreciations: 12 }),
  example("demo-pending", { status: "pending", publishedAt: null, title: "Menemani teman belajar", body: "Sore ini kami belajar bersama dan saling membantu memahami materi yang sulit." }),
  example("demo-rejected", { status: "rejected", publishedAt: null, title: "Buku untuk adik-adik", body: "Kami mengumpulkan buku bacaan untuk dibagikan kepada adik-adik di sekitar.", reason: "Tambahkan cerita tentang kegiatan pembagian bukunya." }),
];
const mine = new Set(["demo-pending", "demo-rejected"]);
const assets = new Map<string, PublicAsset>();
let admin = false;

export async function previewApi<T>(path: string, options?: RequestInit): Promise<T> {
  options?.signal?.throwIfAborted();
  const url = new URL(path, "https://ui-preview.invalid");
  const method = options?.method ?? "GET";
  const body = typeof options?.body === "string" ? JSON.parse(options.body) : {};
  let result: unknown;
  if (url.pathname === "/api/session") result = { admin, backend: "preview" };
  else if (url.pathname === "/api/admin/login") { admin = true; result = { ok: true }; }
  else if (url.pathname === "/api/admin/logout") { admin = false; result = { ok: true }; }
  else if (url.pathname === "/api/uploads" && options?.body instanceof FormData) {
    const file = options.body.get("file");
    if (!(file instanceof File)) throw new Error("Pilih berkas terlebih dahulu.");
    const asset: PublicAsset = { id: crypto.randomUUID(), provider: "local", mime: file.type, status: "ready", playbackId: null, url: URL.createObjectURL(file) };
    assets.set(asset.id, asset); result = asset;
  } else if (url.pathname.startsWith("/api/uploads/") && method === "DELETE") {
    const id = url.pathname.split("/").at(-1)!; const asset = assets.get(id);
    if (asset) URL.revokeObjectURL(asset.url);
    assets.delete(id); result = { ok: true };
  } else if (url.pathname === "/api/posts" && method === "GET") {
    const scope = url.searchParams.get("scope"); const kind = url.searchParams.get("kind"); const query = (url.searchParams.get("q") ?? "").toLocaleLowerCase("id");
    if (scope === "admin" && !admin) throw new Error("Masuk sebagai admin.");
    const filtered = posts.filter(p => (scope === "mine" ? mine.has(p.id) : scope === "admin" ? p.status === url.searchParams.get("status") : p.status === "approved") && (!kind || p.kind === kind) && `${p.title} ${p.body} ${p.subject}`.toLocaleLowerCase("id").includes(query));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    result = { posts: filtered.slice(offset, offset + 20), hasMore: filtered.length > offset + 20 };
  } else if (url.pathname === "/api/posts" && method === "POST") {
    const input: Submission = submissionSchema.parse(body); const timestamp = new Date().toISOString();
    const post: Post = { ...base, ...input, id: crypto.randomUUID(), status: "pending", createdAt: timestamp, publishedAt: null, assets: input.assetIds.map(id => { const asset = assets.get(id); if (!asset) throw new Error("Unggahan tidak ditemukan."); return asset; }) };
    posts.unshift(post); mine.add(post.id); result = { post };
  } else {
    const parts = url.pathname.split("/"); const isAdmin = parts[2] === "admin";
    const id = parts[isAdmin ? 4 : 3]; const post = posts.find(p => p.id === id);
    if (!post) throw new Error("Kiriman tidak ditemukan.");
    if (!isAdmin && method === "GET" && parts.length === 4) {
      if (post.status !== "approved" && !mine.has(id) && !admin) throw new Error("Kiriman tidak ditemukan.");
      result = post;
    } else if (isAdmin && method === "POST") {
      if (!admin) throw new Error("Masuk sebagai admin.");
      const input = moderationSchema.parse(body);
      if (body.revision !== post.revision) throw new Error("Kiriman telah berubah.");
      post.status = input.action === "approve" ? "approved" : input.action === "hide" ? "hidden" : "rejected";
      post.publishedAt = input.action === "approve" ? new Date().toISOString() : null; post.reason = input.reason; post.revision++; result = { post };
    } else if (parts[4] === "appreciate" && method === "POST") {
      post.appreciated = !post.appreciated; post.appreciations += post.appreciated ? 1 : -1; result = { active: post.appreciated, count: post.appreciations };
    } else if (parts[4] === "report" && method === "POST") { post.reports = (post.reports ?? 0) + 1; result = { ok: true }; }
    else if (method === "PUT" && mine.has(id)) {
      const input = submissionSchema.parse(body);
      Object.assign(post, input, { assets: input.assetIds.map(id => assets.get(id) ?? post.assets.find(a => a.id === id)).filter(Boolean), status: "pending", publishedAt: null, reason: "", revision: post.revision + 1 }); result = { post };
    } else throw new Error("Aksi tidak tersedia dalam demo.");
  }
  return structuredClone(result) as T;
}
