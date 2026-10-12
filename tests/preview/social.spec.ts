import { test, expect, type Page } from "@playwright/test";

const nav = (page: Page) => page.getByRole("navigation", { name: "Navigasi utama" }).filter({ visible: true });
const storyCard = (page: Page, body: string) => page.locator("article.post-card").filter({ has: page.getByText(body, { exact: true }) });
const sample = "Punya buku yang sudah selesai dibaca? Yuk, kumpulkan dan bagikan untuk teman-teman yang membutuhkan.";
async function admin(page: Page) {
  await page.getByRole("link", { name: "Admin", exact: true }).filter({ visible: true }).click();
  const login = page.getByRole("button", { name: "Coba admin" });
  const controls = page.getByRole("group", { name: "Jenis moderasi" });
  await expect(login.or(controls)).toBeVisible();
  if (await login.isVisible()) await login.click();
  await expect(page.getByRole("group", { name: "Jenis moderasi" })).toBeVisible();
}
async function create(page: Page, body: string, parts: string[] = []) {
  await page.getByRole("button", { name: "Kirim", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cerita singkat", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "Ruang", exact: true })).toBeEnabled();
  await dialog.getByRole("combobox", { name: "Ruang", exact: true }).selectOption("belajar-bareng");
  await dialog.getByRole("textbox", { name: "Cerita singkat", exact: true }).fill(body);
  for (let i = 0; i < parts.length; i++) {
    await dialog.getByRole("button", { name: "Tambah lanjutan", exact: true }).click();
    await dialog.getByRole("textbox", { name: `Bagian ${i + 2}`, exact: true }).fill(parts[i]);
  }
  await dialog.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Menunggu review." })).toBeVisible();
  await dialog.getByRole("button", { name: "Selesai", exact: true }).click();
  const card = storyCard(page, body); await expect(card).toBeVisible();
  const href = await card.getByRole("link", { name: /Lihat thread/ }).getAttribute("href");
  return new URL(href!, "https://demo.invalid").searchParams.get("id")!;
}
async function approve(page: Page, body: string) {
  await admin(page); await page.getByRole("group", { name: "Jenis moderasi" }).getByRole("button", { name: "Kiriman", exact: true }).click();
  await storyCard(page, body).getByRole("button", { name: "Terbitkan", exact: true }).click();
  await expect(storyCard(page, body)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(storyCard(page, sample)).toBeVisible(); });

test("rooms, follow filters, saved posts, context links, and browser-local reset", async ({ page }) => {
  const requests: string[] = []; const errors: string[] = [];
  page.on("request", req => { if (new URL(req.url()).pathname.startsWith("/api/")) requests.push(req.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await nav(page).getByRole("link", { name: "Ruang", exact: true }).click();
  await expect(page.locator(".room-card")).toHaveCount(5);
  while (await page.getByRole("button", { name: /^Berhenti mengikuti / }).count()) {
    const followed = page.getByRole("button", { name: /^Berhenti mengikuti / }).first();
    const name = await followed.getAttribute("aria-label");
    await followed.click();
    await expect(page.getByRole("button", { name: name!, exact: true })).toHaveCount(0);
  }
  await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  await page.getByRole("button", { name: "Diikuti", exact: true }).click();
  await expect(page.getByText("Ikuti Ruang untuk melihat kirimannya di sini.", { exact: true })).toBeVisible();
  await nav(page).getByRole("link", { name: "Ruang", exact: true }).click();
  await expect(page.locator(".room-card")).toHaveCount(5);
  const room = page.locator(".room-card").filter({ has: page.getByRole("heading", { name: "Belajar Bareng", exact: true }) });
  await room.getByRole("button", { name: "Ikuti Belajar Bareng", exact: true }).click();
  await expect(room.getByRole("button", { name: "Berhenti mengikuti Belajar Bareng", exact: true })).toBeVisible();
  await room.getByRole("link").click();
  await expect(page).toHaveURL(/\/ruang\?slug=belajar-bareng/);
  await expect(page.getByRole("heading", { name: "Belajar Bareng", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Cari di Ruang", exact: true }).fill("Punya buku");
  await expect(page.locator("article.post-card")).toHaveCount(1);
  await storyCard(page, sample).getByRole("button", { name: "Simpan kiriman", exact: true }).click();
  await expect(storyCard(page, sample).getByRole("button", { name: "Batalkan simpan", exact: true })).toBeVisible();
  await storyCard(page, sample).getByRole("link", { name: /Balas/ }).click();
  await expect(page.getByRole("heading", { name: "Diskusi", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Kembali", exact: true }).click();
  await expect(page).toHaveURL(/\/ruang\?slug=belajar-bareng/);
  await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  await page.getByRole("button", { name: "Diikuti", exact: true }).click();
  await expect(page.locator(".post-room")).toHaveCount(20);
  expect((await page.locator(".post-room").allTextContents()).every(value => value === "Belajar Bareng")).toBeTruthy();
  await nav(page).getByRole("link", { name: "Kiriman saya", exact: true }).click();
  await page.getByRole("button", { name: "Tersimpan", exact: true }).click();
  await expect(storyCard(page, sample)).toBeVisible();
  await storyCard(page, sample).getByRole("button", { name: "Batalkan simpan", exact: true }).click();
  await expect(storyCard(page, sample)).toHaveCount(0);
  while (await page.getByRole("button", { name: "Batalkan simpan", exact: true }).count()) await page.getByRole("button", { name: "Batalkan simpan", exact: true }).first().click();
  await expect(page.getByText("Simpan kiriman yang ingin kamu baca lagi.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("article.post-card")).toHaveCount(10);
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test("compose a reviewed thread, append, reject, correct, and publish its continuation", async ({ page }) => {
  const body = "Kita mulai kegiatan berbagi buku pekan ini.";
  const initial = "Bagian kedua: kita memilah buku bersama.";
  const id = await create(page, body, [initial]);
  await expect(storyCard(page, body).getByText(initial, { exact: true })).toBeVisible();
  await approve(page, body);
  await nav(page).getByRole("link", { name: "Kiriman saya", exact: true }).click();
  await storyCard(page, body).getByRole("link", { name: /Balas/ }).click();
  await expect(page.locator(".thread-part").getByText(initial, { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Lanjutan", exact: true }).fill("Perkembangan kegiatan terbaru.");
  await page.getByRole("button", { name: "Kirim lanjutan", exact: true }).click();
  await expect(page.locator(".thread-part").filter({ hasText: "Perkembangan kegiatan terbaru." }).getByText("Menunggu review", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit kiriman", exact: true })).toHaveCount(0);
  await admin(page);
  await page.getByRole("group", { name: "Jenis moderasi" }).getByRole("button", { name: "Lanjutan", exact: true }).click();
  await page.locator(".social-review-card").filter({ hasText: "Perkembangan kegiatan terbaru." }).getByRole("button", { name: "Kembalikan lanjutan", exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByRole("textbox", { name: "Alasan", exact: true }).fill("Tambahkan konteks kegiatan.");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await nav(page).getByRole("link", { name: "Kiriman saya", exact: true }).click();
  await storyCard(page, body).getByRole("link", { name: /Balas/ }).click();
  await page.getByRole("button", { name: "Perbaiki lanjutan", exact: true }).click();
  await page.getByRole("textbox", { name: "Lanjutan", exact: true }).fill("Perkembangan lengkap: buku sudah siap dibagikan Sabtu.");
  await page.getByRole("button", { name: "Kirim lanjutan", exact: true }).click();
  await admin(page); await page.getByRole("group", { name: "Jenis moderasi" }).getByRole("button", { name: "Lanjutan", exact: true }).click();
  await page.locator(".social-review-card").filter({ hasText: "Perkembangan lengkap: buku sudah siap dibagikan Sabtu." }).getByRole("button", { name: "Terbitkan lanjutan", exact: true }).click();
  await expect(page.locator(".social-review-card").filter({ hasText: "Perkembangan lengkap: buku sudah siap dibagikan Sabtu." })).toHaveCount(0);
  await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  await expect(storyCard(page, body).getByText("3 bagian", { exact: true })).toBeVisible();
  await storyCard(page, body).getByRole("link", { name: /Balas/ }).click();
  await expect(page).toHaveURL(new RegExp(`/diskusi\\?id=${id}`));
  await expect(page.locator(".thread-part")).toHaveCount(2);
  await expect(page.getByText("Perkembangan lengkap: buku sudah siap dibagikan Sabtu.", { exact: true })).toBeVisible();
});

test("anonymous replies, flattened nesting, deletion placeholders, reports, and discussion locks", async ({ page }) => {
  await storyCard(page, sample).getByRole("link", { name: /Balas/ }).click();
  await expect(page.locator('[data-reply-id="demo-reply-a"] strong')).toHaveText("Anonim A");
  await page.locator('[data-reply-id="demo-reply-a"]').getByRole("button", { name: "Balas Anonim A", exact: true }).click();
  await page.getByRole("textbox", { name: "Balasan", exact: true }).fill("Saya bisa ikut membawa buku.");
  await page.getByRole("button", { name: "Kirim balasan", exact: true }).click();
  const own = page.locator("article.discussion-reply").filter({ hasText: "Saya bisa ikut membawa buku." });
  await expect(own.locator("strong")).toHaveText("Anonim C"); await expect(own.getByText("Anda", { exact: true })).toBeVisible();
  await own.getByRole("button", { name: "Balas Anonim C", exact: true }).click();
  await page.getByRole("textbox", { name: "Balasan", exact: true }).fill("Tambahan: ada buku cerita juga.");
  await page.getByRole("button", { name: "Kirim balasan", exact: true }).click();
  await expect(page.locator(".nested-replies .nested-replies")).toHaveCount(0);
  await own.getByRole("button", { name: "Hapus balasan", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hapus balasan", exact: true }).click();
  await expect(page.getByText("Balasan dihapus.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Tambahan: ada buku cerita juga.", { exact: true })).toBeVisible();
  await page.locator('[data-reply-id="demo-reply-a"]').getByRole("button", { name: "Laporkan balasan", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Alasan", exact: true }).fill("Periksa konteks balasan ini.");
  await page.getByRole("dialog").getByRole("button", { name: "Kirim laporan", exact: true }).click();
  await admin(page); await page.getByRole("group", { name: "Jenis moderasi" }).getByRole("button", { name: "Balasan", exact: true }).click();
  await expect(page.getByText("Periksa konteks balasan ini.", { exact: true })).toBeVisible();
  await page.locator(".social-review-card").filter({ hasText: "Periksa konteks balasan ini." }).getByRole("button", { name: "Sembunyikan balasan", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Alasan", exact: true }).fill("Tidak sesuai aturan diskusi.");
  await page.getByRole("dialog").getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Periksa konteks balasan ini.", { exact: true })).toHaveCount(0);
  await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  await storyCard(page, sample).getByRole("link", { name: /Balas/ }).click();
  await page.getByRole("button", { name: "Kunci diskusi", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Balasan", exact: true })).toHaveCount(0);
  await expect(page.getByText("Diskusi dikunci. Balasan dan lanjutan baru dihentikan.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Buka diskusi", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Balasan", exact: true })).toBeVisible();
  await nav(page).getByRole("link", { name: "Kiriman saya", exact: true }).click();
  await page.getByRole("group", { name: "Kiriman pribadi" }).getByRole("button", { name: "Balasan", exact: true }).click();
  await expect(page.getByText("Tambahan: ada buku cerita juga.", { exact: true })).toBeVisible();
});

test("admin creates and edits rooms while preserving their permalink", async ({ page }) => {
  await admin(page); await page.getByRole("group", { name: "Jenis moderasi" }).getByRole("button", { name: "Ruang", exact: true }).click();
  await page.getByRole("textbox", { name: "Nama Ruang", exact: true }).fill("Kegiatan Bersama");
  await page.getByRole("textbox", { name: "Deskripsi Ruang", exact: true }).fill("Ruang untuk kegiatan positif bersama.");
  await page.getByRole("button", { name: "Buat Ruang", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kegiatan Bersama", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Kegiatan Bersama", exact: true }).click();
  await page.getByRole("textbox", { name: "Nama Ruang", exact: true }).fill("Relawan Bersama");
  await page.getByRole("button", { name: "Simpan Ruang", exact: true }).click();
  const room = page.locator(".room-card").filter({ has: page.getByRole("heading", { name: "Relawan Bersama", exact: true }) });
  await expect(room.getByRole("link")).toHaveAttribute("href", "/ruang?slug=kegiatan-bersama");
  await room.getByRole("link").click();
  await page.getByRole("button", { name: "Kirim ke Ruang", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Ruang", exact: true }).locator("option:checked")).toHaveText("Relawan Bersama");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/slug=kegiatan-bersama/);
});

test("root edits return threads to review, bounded composer, and accessible mobile/deep links", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const body = "Cerita baik untuk diuji bersama."; await create(page, body); await approve(page, body);
  await nav(page).getByRole("link", { name: "Kiriman saya", exact: true }).click();
  await storyCard(page, body).getByRole("button", { name: "Edit kiriman", exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByRole("textbox", { name: "Cerita singkat", exact: true }).fill("Cerita yang diperbarui dan perlu review.");
  await dialog.getByRole("button", { name: "Kirim", exact: true }).click(); await dialog.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(storyCard(page, "Cerita yang diperbarui dan perlu review.").getByText("Menunggu review", { exact: true })).toBeVisible();
  await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  await expect(storyCard(page, "Cerita yang diperbarui dan perlu review.")).toHaveCount(0);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await nav(page).getByRole("link", { name: "Ruang", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
    await storyCard(page, sample).getByRole("link", { name: /Balas/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  }
  await page.getByRole("button", { name: "Kirim", exact: true }).filter({ visible: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("dialog").getByRole("button", { name: "Tambah lanjutan", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Tambah lanjutan", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("textbox", { name: "Cerita singkat", exact: true })).toHaveAttribute("maxlength", "500");
  await page.keyboard.press("Escape");
  await page.goto("/ruang?slug=missing"); await expect(page.locator("main").getByRole("alert")).toHaveText("Ruang tidak ditemukan.");
  await page.goto("/diskusi?id=missing"); await expect(page.locator("main").getByRole("alert")).toHaveText("Diskusi tidak tersedia.");
  await page.goto("/diskusi?id=demo-thread&back=https%3A%2F%2Fevil.example"); await expect(page.getByRole("link", { name: "Kembali", exact: true })).toHaveAttribute("href", "/");
});
