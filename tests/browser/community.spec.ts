import { test, expect, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
const origin = "http://localhost:3137";
const password = "test-admin-not-for-production";
async function send(request: APIRequestContext, url: string, data: unknown) { return request.post(url, { data, headers: { Origin: origin } }); }
async function admin(request: APIRequestContext) { expect((await send(request, "/api/admin/login", { password })).ok()).toBeTruthy(); }

test("anonymous article submission and mobile layout", async ({ page }) => {
  const unique = `Belajar bersama ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Ada kebaikan hari ini?" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Artikel", exact: true }).click();
  await dialog.getByLabel("Judul", { exact: true }).fill(unique);
  await dialog.getByLabel("Artikel", { exact: true }).fill("Membantu teman memahami pelajaran dengan sabar.");
  await dialog.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(dialog.getByText("Menunggu review.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Selesai" }).click();
  await expect(page).toHaveURL(/view=mine/);
  await expect(page.getByText(unique, { exact: true })).toBeVisible();
  await expect(page.getByText("Menunggu review", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("all four formats stay private until admin approves; reactions and reports work", async ({ browser }) => {
  const owner = await browser.newContext({ baseURL: origin });
  const stranger = await browser.newContext({ baseURL: origin });
  const reviewer = await browser.newContext({ baseURL: origin });
  try {
    const upload = await owner.request.post("/api/uploads", { headers: { Origin: origin }, multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: readFileSync("public/assets/community.jpg") } } });
    expect(upload.status()).toBe(201); const image = await upload.json();
    expect((await stranger.request.get(image.url)).status()).toBe(404);
    const videoUpload = await owner.request.post("/api/uploads", { headers: { Origin: origin }, multipart: { file: { name: "activity.mp4", mimeType: "video/mp4", buffer: readFileSync("tests/fixtures/activity.mp4") } } });
    expect(videoUpload.status()).toBe(201); const video = await videoUpload.json();
    const bodies = [
      { kind: "photo", body: "Membantu kegiatan warga.", assetIds: [image.id] },
      { kind: "video", body: "Cerita kebaikan dalam video.", assetIds: [video.id] },
      { kind: "article", title: "Berbagi waktu", body: "Meluangkan waktu membantu teman belajar.", assetIds: [] },
      { kind: "link", title: "Kontribusi komunitas", body: "Website hasil kontribusi untuk komunitas.", url: "https://example.com/community", assetIds: [] },
    ];
    await admin(reviewer.request);
    for (const data of bodies) {
      const submitted = await send(owner.request, "/api/posts", { ...data, status: "approved" }); expect(submitted.status()).toBe(201); const post = await submitted.json();
      expect(post.status).toBe("pending"); expect(post.ownerId).toBeUndefined();
      expect((await stranger.request.get(`/api/posts/${post.id}`)).status()).toBe(404);
      expect((await send(stranger.request, `/api/admin/posts/${post.id}`, { action: "approve", revision: 1 })).status()).toBe(401);
      expect((await send(reviewer.request, `/api/admin/posts/${post.id}`, { action: "approve", revision: 1 })).ok()).toBeTruthy();
      expect((await stranger.request.get(`/api/posts/${post.id}`)).status()).toBe(200);
      expect((await send(stranger.request, `/api/posts/${post.id}/appreciate`, {})).ok()).toBeTruthy();
      expect((await send(stranger.request, `/api/posts/${post.id}/report`, { reason: "Periksa konteks" })).ok()).toBeTruthy();
    }
    expect((await stranger.request.get(image.url)).status()).toBe(200);
    const range = await stranger.request.get(video.url, { headers: { Range: "bytes=0-31" } }); expect(range.status()).toBe(206); expect((await range.body()).length).toBe(32);
    const feed = await stranger.request.get("/api/posts"); const result = await feed.json();
    expect(JSON.stringify(result)).not.toContain("ownerId"); expect(JSON.stringify(result)).not.toContain("owner_id"); expect(JSON.stringify(result)).not.toContain(".data/");
  } finally { await Promise.all([owner.close(), stranger.close(), reviewer.close()]); }
});

test("reject, resubmit, stale review protection, and hide revoke media access", async ({ browser }) => {
  const owner = await browser.newContext({ baseURL: origin }); const reviewer = await browser.newContext({ baseURL: origin }); const other = await browser.newContext({ baseURL: origin });
  try {
    const upload = await owner.request.post("/api/uploads", { headers: { Origin: origin }, multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: readFileSync("public/assets/community.jpg") } } });
    const image = await upload.json(); const input = { kind: "photo", body: "Membantu kegiatan komunitas.", assetIds: [image.id] };
    const post = await (await send(owner.request, "/api/posts", input)).json();
    await admin(reviewer.request);
    expect((await send(reviewer.request, `/api/admin/posts/${post.id}`, { action: "reject", revision: 1, reason: "Tambahkan konteks." })).ok()).toBeTruthy();
    expect((await other.request.put(`/api/posts/${post.id}`, { headers: { Origin: origin }, data: input })).status()).toBe(404);
    const updated = await owner.request.put(`/api/posts/${post.id}`, { headers: { Origin: origin }, data: { ...input, body: "Membantu menyiapkan buku untuk belajar bersama." } }); expect(updated.ok()).toBeTruthy();
    expect((await send(reviewer.request, `/api/admin/posts/${post.id}`, { action: "approve", revision: 1 })).status()).toBe(409);
    expect((await send(reviewer.request, `/api/admin/posts/${post.id}`, { action: "approve", revision: 2 })).ok()).toBeTruthy();
    expect((await other.request.get(image.url)).status()).toBe(200);
    expect((await send(reviewer.request, `/api/admin/posts/${post.id}`, { action: "hide", revision: 2, reason: "Privasi orang lain." })).ok()).toBeTruthy();
    expect((await other.request.get(image.url)).status()).toBe(404);
    expect((await other.request.get(`/api/posts/${post.id}`)).status()).toBe(404);
  } finally { await Promise.all([owner.close(), reviewer.close(), other.close()]); }
});

test("unsafe links, file spoofing, foreign origin, and unowned attachments are rejected", async ({ browser }) => {
  const owner = await browser.newContext({ baseURL: origin }); const other = await browser.newContext({ baseURL: origin });
  try {
    expect((await send(owner.request, "/api/posts", { kind: "link", body: "Contoh kontribusi", url: "javascript:alert(1)" })).status()).toBe(400);
    expect((await owner.request.post("/api/posts", { headers: { Origin: "https://evil.example" }, data: { kind: "article", title: "Test", body: "Test content" } })).status()).toBe(403);
    const spoofed = await owner.request.post("/api/uploads", { headers: { Origin: origin }, multipart: { file: { name: "bad.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>bad</script>") } } }); expect(spoofed.status()).toBe(400);
    const uploaded = await owner.request.post("/api/uploads", { headers: { Origin: origin }, multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: readFileSync("public/assets/community.jpg") } } });
    const image = await uploaded.json();
    expect((await send(other.request, "/api/posts", { kind: "photo", body: "Mencoba memakai unggahan orang lain", assetIds: [image.id] })).status()).toBe(409);
    expect((await other.request.delete(`/api/uploads/${image.id}`, { headers: { Origin: origin } })).status()).toBe(404);
    expect((await owner.request.delete(`/api/uploads/${image.id}`, { headers: { Origin: origin } })).ok()).toBeTruthy();
  } finally { await Promise.all([owner.close(), other.close()]); }
});

test("dialog keyboard focus, cancellation, and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
  await page.getByRole("button", { name: "Ada kebaikan hari ini?" }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBeTruthy();
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(page).toHaveURL(/\/$/);
});

test("admin reviews a submission through the interface", async ({ page, browser }) => {
  const owner = await browser.newContext({ baseURL: origin });
  try {
    const title = `Review UI ${Date.now()}`;
    const created = await send(owner.request, "/api/posts", { kind: "article", title, body: "Berbagi buku untuk belajar bersama.", assetIds: [] });
    expect(created.status()).toBe(201);
    await page.goto("/admin");
    await page.getByLabel("Kata sandi", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    const card = page.locator("article").filter({ hasText: title });
    await expect(card).toBeVisible(); await card.getByRole("button", { name: "Terbitkan" }).click();
    await expect(page.getByText("Kiriman terbit.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Terbit", exact: true }).click();
    await expect(page.locator("article").filter({ hasText: title })).toBeVisible();
    const feed = await owner.request.get("/api/posts"); expect((await feed.json()).posts.some((post: { title: string }) => post.title === title)).toBeTruthy();
  } finally { await owner.close(); }
});
