import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const preview = path.join(root, ".ui-preview");
const app = path.join(preview, "app");
await rm(preview, { recursive: true, force: true });
await mkdir(app, { recursive: true });
for (const entry of ["src", "public", "package.json", "tsconfig.json", "postcss.config.mjs", "next-env.d.ts"]) {
  await cp(path.join(root, entry), path.join(app, entry), { recursive: true, filter: source => ![path.join(root, "src/app/api"), path.join(root, "src/lib/server")].includes(source) });
}
await symlink(path.join(root, "node_modules"), path.join(app, "node_modules"), "dir");
await writeFile(path.join(app, "next.config.ts"), 'export default { output: "export", images: { unoptimized: true }, poweredByHeader: false };\n');
execFileSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"], { cwd: app, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_UI_PREVIEW: "true" } });
await cp(path.join(app, "out"), path.join(preview, "out"), { recursive: true });
console.log("Frontend-only preview: .ui-preview/out (no API routes or credentials)");
