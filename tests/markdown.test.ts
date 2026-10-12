import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../src/components/markdown";

const render = (body: string) => renderToStaticMarkup(createElement(Markdown, { children: body }));

test("articles render Markdown structure and GFM without exposing raw syntax", () => {
  const html = render("## Belajar bersama\n\n**Berbagi** dan *mendengarkan*.\n\n- Buku\n- Pensil\n\n> Kebaikan kecil.\n\n```js\nconst baik = true;\n```\n\n| Hari | Kegiatan |\n| --- | --- |\n| Senin | Belajar |\n\n[Referensi](https://example.com)");
  for (const fragment of ["<h2>Belajar bersama</h2>", "<strong>Berbagi</strong>", "<em>mendengarkan</em>", "<ul>", "<li>Buku</li>", "<blockquote>", "<pre>", "<table>", '<a href="https://example.com" target="_blank" rel="noopener noreferrer">']) assert.ok(html.includes(fragment), fragment);
});

test("article Markdown rejects executable links and raw HTML, and renders accessible images", () => {
  const html = render('[Klik](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\n<img src="https://tracker.example/pixel" onerror="alert(1)">\n\n![Foto kegiatan](https://tracker.example/pixel)');
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("onerror"));
  assert.ok(html.includes('alt="Foto kegiatan"'));
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(html.includes('referrerPolicy="no-referrer"'));
});
