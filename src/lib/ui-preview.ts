import type { Post, PublicAsset } from "./types";
import { moderationSchema } from "./validation";
import { pollSubmissionSchema, pollVoteSchema, previewSubmissionSchema } from "./poll-validation";
import { canEditPost, PREVIEW_POST_CHANGED, type FeedPost, type PollPost, type PreviewSubmission } from "./preview-types";

// Browser-only demo data. This module never calls the production API.
export function createPreviewApi() {
  const now = Date.now();
  const base = { subject: "", title: "", body: "", url: "", reason: "", example: true, revision: 1, appreciations: 0, appreciated: false, assets: [] };
  function example(id: string, values: Partial<Post>): Post {
    return { ...base, id, kind: "article", status: "approved", createdAt: new Date(now - 3600000).toISOString(), publishedAt: new Date(now - 3600000).toISOString(), ...values };
  }
  const posts: FeedPost[] = [
    example("demo-photo", { kind: "photo", subject: "Teman-teman relawan", body: "Hadir, ikut membantu, dan pulang membawa cerita baik. Terima kasih untuk setiap teman yang meluangkan waktu menjadi relawan.", appreciations: 24, assets: [{ id: "demo-photo-asset", provider: "local", mime: "image/jpeg", status: "ready", playbackId: null, url: "/assets/community.jpg" }] }),
    example("demo-article", { title: "Berbagi ilmu, satu sore setiap minggu.", subject: "Teman-teman yang berbagi ilmu", body: "Tidak semua kebaikan harus dimulai dari hal besar. Kadang, cukup menyediakan waktu untuk **menemani seseorang belajar**.\n\n## Mulai dari satu sore\n\nDalam contoh cerita ini, beberapa teman membuka sesi belajar bersama.\n\n- Membawa buku untuk dibaca bersama.\n- Mendengarkan pertanyaan dengan sabar.\n- Menjelaskan kembali pelajaran yang belum dipahami.\n\n> Satu sore yang sederhana bisa membuat seseorang lebih percaya diri untuk mencoba lagi.", appreciations: 18 }),
    example("demo-link", { kind: "link", title: "Pengetahuan untuk siapa saja", body: "Contoh kontribusi: menulis dan memperbaiki artikel agar lebih banyak orang bisa belajar.", url: "https://www.wikipedia.org/", appreciations: 12 }),
    example("demo-pending", { status: "pending", publishedAt: null, title: "Menemani teman belajar", body: "Sore ini kami belajar bersama dan saling membantu memahami materi yang sulit." }),
    example("demo-rejected", { status: "rejected", publishedAt: null, title: "Buku untuk adik-adik", body: "Kami mengumpulkan buku bacaan untuk dibagikan kepada adik-adik di sekitar.", reason: "Tambahkan cerita tentang kegiatan pembagian bukunya." }),
  ];
  const photoExamples = [
    { id: "cleanup", title: "Bersih lingkungan, mulai dari sekitar.", subject: "Teman-teman relawan", body: "Satu langkah kecil untuk lingkungan yang lebih nyaman. Terima kasih sudah ikut menjaga ruang bersama.", image: "community-cleanup", count: 16 },
    { id: "books", title: "Buku baru untuk cerita berikutnya.", subject: "Teman-teman yang berbagi buku", body: "Buku yang sudah selesai kita baca bisa menjadi awal cerita bagi orang lain. Yuk, terus berbagi bacaan.", image: "book-sharing", count: 21 },
    { id: "study", title: "Belajar jadi lebih ringan bersama.", subject: "Teman belajar", body: "Duduk bersama, bertanya, dan saling menjelaskan. Kadang bantuan sederhana membuat hari seseorang lebih mudah.", image: "study-together", count: 12 },
    { id: "meals", title: "Berbagi makan, berbagi perhatian.", subject: "Teman-teman yang menyiapkan makanan", body: "Menyiapkan satu paket makanan dengan penuh perhatian. Kebaikan kecil bisa menghangatkan hari.", image: "meal-sharing", count: 19 },
  ];
  const photoPosts = photoExamples.map((item, index) => {
    const timestamp = new Date(now - (index + 1) * 15 * 60000).toISOString();
    return example(`demo-photo-${item.id}`, {
      kind: "photo", title: item.title, subject: item.subject, body: `Foto ilustrasi AI · konten contoh. ${item.body}`, appreciations: item.count,
      createdAt: timestamp, publishedAt: timestamp,
      assets: [{ id: `demo-photo-${item.id}-asset`, provider: "local", mime: "image/webp", status: "ready", playbackId: null, url: `/assets/demo/${item.image}.webp` }],
    });
  });
  posts.unshift(...photoPosts);
  function pollExample(id: string, title: string, labels: string[], counts: number[], participants: number, multiple = false, closed = false): PollPost {
    return { ...example(id, { title }), kind: "poll", poll: { options: labels.map((label, index) => ({ id: crypto.randomUUID(), label, votes: counts[index] })), multiple, closed, participants, ballot: [] } };
  }
  posts.splice(2, 0,
    pollExample("demo-poll-single", "Kegiatan sosial berikutnya?", ["Donor darah", "Bersih lingkungan", "Penggalangan buku"], [4, 3, 1], 8),
    pollExample("demo-poll-multiple", "Apa yang bisa kamu bantu?", ["Menyiapkan buku", "Mengajar", "Mengantar donasi"], [5, 4, 2], 6, true),
    pollExample("demo-poll-closed", "Kapan kita berbagi buku?", ["Sabtu pagi", "Minggu pagi"], [6, 4], 10, false, true),
  );
  function changed(post: FeedPost) {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PREVIEW_POST_CHANGED, { detail: structuredClone(post) }));
  }
  function inputPoll(input: Extract<PreviewSubmission, { kind: "poll" }>) {
    return { options: input.poll.options.map(option => ({ ...option, votes: 0 })), multiple: input.poll.multiple, closed: false, participants: 0, ballot: [] };
  }
  const mine = new Set(["demo-pending", "demo-rejected"]);
  const assets = new Map<string, PublicAsset>();
  let admin = false;

  return async function previewApi<T>(path: string, options?: RequestInit): Promise<T> {
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
      const input: PreviewSubmission = previewSubmissionSchema.parse(body); const timestamp = new Date().toISOString();
      const common = { ...base, ...input, id: crypto.randomUUID(), status: "pending" as const, createdAt: timestamp, publishedAt: null, assets: input.assetIds.map(id => { const asset = assets.get(id); if (!asset) throw new Error("Unggahan tidak ditemukan."); return asset; }) };
      const post: FeedPost = input.kind === "poll" ? { ...common, kind: "poll", poll: inputPoll(input) } : { ...common, kind: input.kind };
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
      } else if (parts[4] === "vote" && method === "POST") {
        if (post.kind !== "poll" || post.status !== "approved") throw new Error("Polling belum tersedia.");
        if (post.poll.closed) throw new Error("Polling sudah ditutup.");
        const { optionIds } = pollVoteSchema.parse(body);
        const selected = new Set(optionIds);
        if (selected.size !== optionIds.length || (!post.poll.multiple && selected.size > 1) || optionIds.some(option => !post.poll.options.some(item => item.id === option))) throw new Error("Pilihan jawaban tidak valid.");
        const previous = new Set(post.poll.ballot);
        for (const option of post.poll.options) option.votes += Number(selected.has(option.id)) - Number(previous.has(option.id));
        post.poll.participants += Number(selected.size > 0) - Number(previous.size > 0);
        post.poll.ballot = optionIds; changed(post); result = { post };
      } else if (parts[4] === "close" && method === "POST") {
        if (!mine.has(id)) throw new Error("Hanya pengirim yang dapat menutup polling.");
        if (post.kind !== "poll" || post.status !== "approved") throw new Error("Polling belum tersedia.");
        post.poll.closed = true; changed(post); result = { post };
      } else if (parts[4] === "appreciate" && method === "POST") {
        post.appreciated = !post.appreciated; post.appreciations += post.appreciated ? 1 : -1; result = { active: post.appreciated, count: post.appreciations };
      } else if (parts[4] === "report" && method === "POST") { post.reports = (post.reports ?? 0) + 1; result = { ok: true }; }
      else if (method === "PUT" && mine.has(id)) {
        if (!canEditPost(post)) throw new Error("Kiriman ini tidak dapat diedit.");
        const input = post.kind === "poll" ? pollSubmissionSchema.parse(body) : previewSubmissionSchema.parse(body);
        if (input.kind !== post.kind) throw new Error("Jenis kiriman tidak dapat diubah.");
        Object.assign(post, input.kind === "poll" ? { ...input, poll: inputPoll(input) } : input, { assets: input.assetIds.map(id => assets.get(id) ?? post.assets.find(a => a.id === id)).filter(Boolean), status: "pending", publishedAt: null, reason: "", revision: post.revision + 1 }); result = { post };
      } else throw new Error("Aksi tidak tersedia dalam demo.");
    }
    return structuredClone(result) as T;
  };
}
export const previewApi = createPreviewApi();
