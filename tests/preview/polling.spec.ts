import { test, expect, type Page } from "@playwright/test";

const nav = (page: Page) => page.getByRole("navigation", { name: "Navigasi utama" }).filter({ visible: true });
const card = (page: Page, title: string) => page.locator("article.post-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
async function create(page: Page, title: string, multiple = false) {
  await page.getByRole("button", { name: "Kirim", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Polling", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Pertanyaan", exact: true }).fill(title);
  await dialog.getByRole("textbox", { name: "Pilihan 1", exact: true }).fill("Donor darah");
  await dialog.getByRole("textbox", { name: "Pilihan 2", exact: true }).fill("Bersih lingkungan");
  if (multiple) await dialog.getByRole("checkbox", { name: "Izinkan beberapa jawaban" }).check();
  await dialog.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Menunggu review." })).toBeVisible();
  await dialog.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("heading", { name: "Kiriman saya", exact: true })).toBeVisible();
}
async function approve(page: Page, title: string) {
  await page.getByRole("link", { name: "Admin", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Coba admin" }).click();
  await card(page, title).getByRole("button", { name: "Terbitkan" }).click();
  await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  await expect(card(page, title)).toBeVisible();
}

test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(page.getByRole("heading", { name: "Beranda", exact: true })).toBeVisible(); });

test("create, review, vote, synchronize gallery and mine, close, and reset without API requests", async ({ page }) => {
  const apiRequests: string[] = []; const errors: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  const title = "Kegiatan sosial pilihan kita?";
  await create(page, title);
  const pending = card(page, title);
  await expect(pending.getByText("Menunggu review", { exact: true })).toBeVisible();
  await expect(pending.getByRole("button", { name: /^Donor darah,/ })).toBeDisabled();
  await approve(page, title);
  const published = card(page, title);
  await expect(published.getByText("0 peserta", { exact: true })).toBeVisible();
  await published.getByRole("button", { name: /^Donor darah,/ }).click();
  await expect(published.getByRole("button", { name: "Donor darah, 1 suara, 100%", exact: true })).toHaveAttribute("aria-pressed", "true");
  await published.getByRole("button", { name: /^Bersih lingkungan,/ }).click();
  await expect(published.getByRole("button", { name: "Donor darah, 0 suara, 0%", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(published.getByText("1 peserta", { exact: true })).toBeVisible();
  await nav(page).getByRole("link", { name: "Jelajahi", exact: true }).click();
  await page.getByRole("button", { name: "Polling", exact: true }).click();
  await page.getByRole("button", { name: `Buka Polling: ${title}`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Bersih lingkungan, 1 suara, 100%", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: /^Donor darah,/ }).click();
  await expect(dialog.getByRole("button", { name: "Donor darah, 1 suara, 100%", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
  await nav(page).getByRole("link", { name: "Kiriman saya", exact: true }).click();
  const mine = card(page, title);
  await expect(mine.getByText("1 peserta", { exact: true })).toBeVisible();
  await expect(mine.getByRole("button", { name: "Edit kiriman", exact: true })).toHaveCount(0);
  await mine.getByRole("button", { name: "Tutup polling", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Batal", exact: true }).click();
  await expect(mine.getByRole("button", { name: /^Donor darah,/ })).toBeEnabled();
  await mine.getByRole("button", { name: "Tutup polling", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tutup polling", exact: true }).click();
  await expect(mine.getByText("Polling ditutup", { exact: true })).toBeVisible();
  await expect(mine.getByRole("button", { name: /^Donor darah,/ })).toBeDisabled();
  await nav(page).getByRole("link", { name: "Beranda", exact: true }).click();
  await expect(card(page, title).getByText("Polling ditutup", { exact: true })).toBeVisible();
  await page.reload(); await expect(card(page, title)).toHaveCount(0);
  expect(apiRequests).toEqual([]); expect(errors).toEqual([]);
});

test("multiple answers, withdrawal, search, and closed examples", async ({ page }) => {
  const title = "Bantuan untuk kegiatan kita?";
  await create(page, title, true); await approve(page, title);
  const poll = card(page, title);
  const a = poll.getByRole("button", { name: /^Donor darah,/ }); const b = poll.getByRole("button", { name: /^Bersih lingkungan,/ });
  await a.click(); await b.click();
  await expect(a).toHaveAttribute("aria-pressed", "true"); await expect(b).toHaveAttribute("aria-pressed", "true");
  await expect(poll.getByText("100%", { exact: true })).toHaveCount(2);
  await expect(poll.getByText("1 peserta", { exact: true })).toBeVisible();
  await a.click(); await b.click();
  await expect(poll.getByText("0 peserta", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Polling", exact: true }).click();
  await page.getByRole("searchbox", { name: "Cari kebaikan" }).fill("Bantuan untuk kegiatan");
  await expect(page.locator("article.post-card")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Cari kebaikan" }).fill("Kapan kita berbagi buku");
  const closed = card(page, "Kapan kita berbagi buku?");
  await expect(closed.getByText("Polling ditutup", { exact: true })).toBeVisible();
  await expect(closed.getByRole("button", { name: /^Sabtu pagi,/ })).toBeDisabled();
});

test("composer validation, option limits, accessible controls, and responsive layout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Kirim", exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Polling", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Untuk siapa?" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Hapus pilihan 1" })).toBeDisabled();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
  }
  await page.getByRole("button", { name: "Kirim", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Polling", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Pertanyaan", exact: true }).fill("Pertanyaan komunitas?");
  await dialog.getByRole("textbox", { name: "Pilihan 1", exact: true }).fill("Jawaban");
  await dialog.getByRole("textbox", { name: "Pilihan 2", exact: true }).fill(" JAWABAN ");
  await dialog.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Pilihan jawaban tidak boleh sama.");
  await dialog.getByRole("textbox", { name: "Pilihan 2", exact: true }).fill("Pilihan lain");
  for (let i = 2; i < 12; i++) await dialog.getByRole("button", { name: "Tambah pilihan", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Tambah pilihan", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("textbox", { name: /^Pilihan / })).toHaveCount(12);
  await dialog.getByRole("button", { name: "Hapus pilihan 12", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: /^Pilihan / })).toHaveCount(11);
  await page.keyboard.press("Escape");
  const poll = card(page, "Kegiatan sosial berikutnya?");
  const answer = poll.getByRole("button", { name: /^Donor darah,/ });
  await answer.focus(); await page.keyboard.press("Space");
  await expect(answer).toHaveAttribute("aria-pressed", "true");
  await expect(poll.getByRole("status")).toHaveText("Pilihan tersimpan.");
  expect(await poll.locator(".poll-option-bar").first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
});
