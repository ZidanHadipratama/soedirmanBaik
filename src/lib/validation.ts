import { z } from "zod";
import { POST_KINDS } from "./types";

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function safeWebsite(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && Boolean(url.hostname);
  } catch { return false; }
}
export const submissionSchema = z.object({
  kind: z.enum(POST_KINDS), subject: z.string().trim().max(80).default(""),
  title: z.string().trim().max(120).default(""), body: z.string().trim().min(3, "Ceritakan kebaikannya.").max(10000),
  url: z.string().trim().max(2000).default(""), assetIds: z.array(z.uuid()).max(4).default([]),
}).superRefine((data, ctx) => {
  const add = (field: string, message: string) => ctx.addIssue({ code: "custom", path: [field], message });
  if (data.kind === "article" && data.title.length < 3) add("title", "Tambahkan judul artikel.");
  if (data.kind === "link" && !safeWebsite(data.url)) add("url", "Gunakan tautan http atau https yang valid.");
  if (data.kind === "photo" && data.assetIds.length < 1) add("assetIds", "Tambahkan foto.");
  if (data.kind === "video" && data.assetIds.length !== 1) add("assetIds", "Tambahkan satu video.");
  if (["article", "link"].includes(data.kind) && data.assetIds.length) add("assetIds", "Jenis kiriman ini tidak memakai unggahan.");
  if (data.kind !== "article" && data.body.length > 2000) add("body", "Maksimal 2.000 karakter.");
});
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const moderationSchema = z.object({ action: z.enum(["approve", "reject", "hide"]), reason: z.string().trim().max(500).default("") })
  .refine(v => v.action === "approve" || v.reason.length >= 3, "Tambahkan alasan singkat.");
export function validateVideo(bytes: Buffer, mime: string) {
  const mp4 = bytes.length > 12 && bytes.subarray(4, 8).toString() === "ftyp";
  const webm = bytes.length > 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return (mime === "video/mp4" && mp4) || (mime === "video/webm" && webm);
}
