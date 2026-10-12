import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...values: ClassValue[]) { return twMerge(clsx(values)); }
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  if (process.env.NEXT_PUBLIC_UI_PREVIEW === "true") {
    const { previewApi } = await import("./ui-preview");
    return previewApi<T>(url, options);
  }
  const response = await fetch(url, { ...options, headers: { ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options?.headers } });
  let data;
  try { data = await response.json(); } catch { throw new Error("Layanan belum merespons. Coba lagi."); }
  if (!response.ok) throw new Error(data.error ?? "Permintaan gagal. Coba lagi.");
  return data as T;
}
export function relativeDate(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Baru saja";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(value));
}

export function safeBackLink(value: string | null, fallback = "/") {
  if (!value?.startsWith("/")) return fallback;
  try { const url = new URL(value, "https://app.invalid"); return url.origin === "https://app.invalid" && ["/", "/ruang", "/diskusi", "/articles", "/admin"].includes(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : fallback; } catch { return fallback; }
}
