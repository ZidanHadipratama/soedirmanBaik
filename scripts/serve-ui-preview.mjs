import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(".ui-preview/out");
const port = Number(process.env.PREVIEW_PORT ?? 3138);
const contentTypes = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mp4": "video/mp4",
};
await stat(path.join(root, "index.html"));
createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const candidate = path.resolve(root, `.${pathname}`);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    let file;
    for (const value of [candidate, `${candidate}.html`, path.join(candidate, "index.html")]) {
      try { if ((await stat(value)).isFile()) { file = value; break; } } catch {}
    }
    if (!file) { response.writeHead(404).end("Not found"); return; }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).on("error", () => response.destroy()).pipe(response);
  } catch { response.writeHead(400).end("Invalid request"); }
}).listen(port, "127.0.0.1", () => console.log(`UI preview: http://localhost:${port}`));
