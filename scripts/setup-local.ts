import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import type { Asset, StoredPost } from "../src/lib/types";

async function main() {
  if (!existsSync(".env.local")) writeFileSync(".env.local", `DATA_BACKEND=local\nAPP_URL=http://localhost:3000\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\n`, { mode: 0o600 });
  process.loadEnvFile(".env.local");
  if (process.env.DATA_BACKEND !== "local") throw new Error("setup:local hanya untuk penyimpanan lokal.");
  if (process.argv.includes("--demo")) {
    const { localStore } = await import("../src/lib/server/store-local");
    const { dataDirectory } = await import("../src/lib/server/config");
    const existing = await localStore.listPosts({ scope: "admin" });
    if (!existing.some(p => p.example)) {
      const owner = randomUUID(); const now = Date.now();
      const photoBytes = await sharp(readFileSync("public/assets/community.jpg")).resize({ width: 1200 }).webp({ quality: 82 }).toBuffer();
      const id = randomUUID(); const dir = path.join(dataDirectory(), "uploads"); await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, `${id}.webp`), photoBytes);
      const asset: Asset = { id, ownerId: owner, postId: null, provider: "local", path: `${id}.webp`, mime: "image/webp", size: photoBytes.length, status: "ready", uploadId: null, muxAssetId: null, playbackId: null, createdAt: new Date(now).toISOString() };
      await localStore.saveAsset(asset);
      const examples: { kind: StoredPost["kind"]; title: string; body: string; subject: string; url: string; assetIds: string[] }[] = [
        { kind: "link", title: "Pengetahuan untuk siapa saja", body: "Contoh kontribusi: menulis dan memperbaiki artikel agar lebih banyak orang bisa belajar.", subject: "", url: "https://www.wikipedia.org/", assetIds: [] },
        { kind: "article", title: "Berbagi ilmu, satu sore setiap minggu.", body: "Tidak semua kebaikan harus dimulai dari hal besar. Kadang, cukup menyediakan waktu untuk menemani seseorang belajar.\n\nDalam contoh cerita ini, beberapa teman membuka sesi belajar bersama. Mereka membawa buku, mendengarkan pertanyaan, dan menjelaskan kembali pelajaran yang belum dipahami.\n\nSatu sore yang sederhana bisa membuat seseorang lebih percaya diri untuk mencoba lagi.", subject: "Teman-teman yang berbagi ilmu", url: "", assetIds: [] },
        { kind: "photo", title: "", body: "Hadir, ikut membantu, dan pulang membawa cerita baik. Terima kasih untuk setiap teman yang meluangkan waktu menjadi relawan.", subject: "Teman-teman relawan", url: "", assetIds: [id] },
      ];
      for (let i = 0; i < examples.length; i++) {
        const { assetIds, ...item } = examples[i];
        const post: StoredPost = { ...item, id: randomUUID(), ownerId: owner, status: "pending", createdAt: new Date(now - (examples.length-i) * 3600000).toISOString(), publishedAt: null, reason: "", example: true, revision: 1 };
        await localStore.submit(post, assetIds); await localStore.moderate(post.id, 1, "approved", "");
      }
      console.log("3 kiriman contoh ditambahkan; semuanya diberi label Contoh.");
    }
  }
  console.log("Siap. Jalankan npm run dev. Kata sandi admin tersimpan di .env.local (tidak ditampilkan).");
}
main().catch(error => { console.error(error.message); process.exit(1); });
