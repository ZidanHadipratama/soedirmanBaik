import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

export function backend(): "local" | "supabase" {
  const chosen = process.env.DATA_BACKEND ?? "local";
  if (chosen !== "local" && chosen !== "supabase") throw new Error("DATA_BACKEND harus local atau supabase.");
  if (process.env.VERCEL && chosen === "local") throw new Error("Hubungkan Supabase sebelum deploy ke Vercel. Penyimpanan lokal tidak permanen di Vercel.");
  if (chosen === "supabase" && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error("Konfigurasi Supabase belum lengkap.");
  return chosen;
}
export function dataDirectory() { const dir = process.env.DATA_DIRECTORY ?? path.join(process.cwd(), ".data"); mkdirSync(dir, { recursive: true, mode: 0o700 }); return dir; }
export function sessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  if (backend() !== "local") throw new Error("SESSION_SECRET minimal 32 karakter wajib diatur.");
  const file = path.join(dataDirectory(), "session.key");
  try { writeFileSync(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  return readFileSync(file, "utf8");
}
