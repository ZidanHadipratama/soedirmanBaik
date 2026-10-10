import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

async function main() {
  const base = process.env.PREVIEW_URL ?? "http://localhost:3000";
  mkdirSync("artifacts", { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined });
  const errors: string[] = [];
  try {
    for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 768, 1024], ["mobile", 390, 844], ["small-mobile", 360, 800]] as const) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(base); await page.waitForLoadState("networkidle");
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`Horizontal overflow: ${name}`);
      await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
      if (name === "desktop") {
        const snapshot = await page.evaluate(() => {
          const shell = document.querySelector(".app-shell")!.cloneNode(true) as HTMLElement;
          shell.querySelectorAll("script").forEach(e => e.remove());
          const css = Array.from(document.styleSheets).map(sheet => { try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join("\n"); } catch { return ""; } }).join("\n");
          return { html: shell.outerHTML, css, bodyClass: document.body.className };
        });
        let html = snapshot.html;
        const images = await page.locator(".app-shell img").evaluateAll(elements => elements.map(e => (e as HTMLImageElement).getAttribute("src")!).filter(Boolean));
        for (const src of new Set(images)) {
          const response = await page.request.get(new URL(src, base).toString());
          const data = `data:${response.headers()["content-type"]};base64,${(await response.body()).toString("base64")}`;
          html = html.replaceAll(src.replaceAll("&", "&amp;"), data).replaceAll(src, data);
        }
        html = html.replace(/srcset="[^"]*"/g, "");
        let css = snapshot.css;
        const fonts = [...new Set([...css.matchAll(/url\(["']?(\/_next\/static\/media\/[^)"']+)["']?\)/g)].map(m => m[1]))];
        for (const font of fonts) { const response = await page.request.get(new URL(font, base).toString()); css = css.replaceAll(font, `data:font/woff2;base64,${(await response.body()).toString("base64")}`); }
        mkdirSync("superdesign/design_iterations", { recursive: true });
        writeFileSync("superdesign/design_iterations/ui_1.html", `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Soedirman Baik — visual reference</title><style>${css}</style></head><body class="${snapshot.bodyClass}">${html}</body></html>`);
      }
      await page.getByRole("button", { name: "Ada kebaikan hari ini?" }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("dialog").evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
      await page.screenshot({ path: `artifacts/${name}-composer.png` });
      await page.close();
    }
    writeFileSync("artifacts/visual-check.json", JSON.stringify({ widths: [1440, 768, 390, 360], horizontalOverflow: false, pageErrors: errors }, null, 2));
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Four responsive widths verified; feed/composer screenshots and Superdesign reference saved. No page errors.");
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exit(1); });
