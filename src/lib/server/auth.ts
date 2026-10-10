import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./config";
import { AppError } from "../validation";

type Identity = { id: string; role: "guest" | "admin"; expires: number };
export function signIdentity(identity: Identity, secret: string) {
  const body = Buffer.from(JSON.stringify(identity)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function readIdentity(value: string | undefined, secret: string, role: Identity["role"]): Identity | null {
  if (!value || value.length > 2048) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const actual = Buffer.from(signature), expected = Buffer.from(createHmac("sha256", secret).update(body).digest("base64url"));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as Identity;
    return data.role === role && typeof data.id === "string" && data.expires > Date.now() ? data : null;
  } catch { return null; }
}
const options = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: Boolean(process.env.VERCEL || process.env.APP_URL?.startsWith("https:")) };
export async function guest(create = false) {
  const jar = await cookies();
  const identity = readIdentity(jar.get("sb_guest")?.value, sessionSecret(), "guest");
  if (identity) return identity.id;
  if (!create) return null;
  const id = randomUUID();
  jar.set("sb_guest", signIdentity({ id, role: "guest", expires: Date.now() + 30 * 86400000 }, sessionSecret()), { ...options, maxAge: 30 * 86400 });
  return id;
}
export async function isAdmin() { return Boolean(readIdentity((await cookies()).get("sb_admin")?.value, sessionSecret(), "admin")); }
export async function requireAdmin() { if (!await isAdmin()) throw new AppError("Masuk sebagai admin.", 401); }
export async function login(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) throw new AppError("Kata sandi admin belum diatur. Jalankan setup:local atau isi ADMIN_PASSWORD.", 503);
  const a = createHmac("sha256", sessionSecret()).update(password).digest();
  const b = createHmac("sha256", sessionSecret()).update(expected).digest();
  if (!timingSafeEqual(a, b)) throw new AppError("Kata sandi tidak cocok.", 401);
  (await cookies()).set("sb_admin", signIdentity({ id: "admin", role: "admin", expires: Date.now() + 8 * 3600000 }, sessionSecret()), { ...options, maxAge: 8 * 3600 });
}
export async function logout() { (await cookies()).delete("sb_admin"); }
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL ?? request.url).origin;
  const localSameOrigin = !process.env.VERCEL && origin === new URL(request.url).origin;
  if (!origin || (origin !== expected && !localSameOrigin)) throw new AppError("Permintaan tidak diizinkan.", 403);
}
