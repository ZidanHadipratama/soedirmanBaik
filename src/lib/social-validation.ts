import { z } from "zod";

export const shortSubmissionSchema = z.object({
  kind: z.literal("short"), body: z.string().trim().min(3, "Tulis cerita singkatmu.").max(500, "Maksimal 500 karakter."),
  title: z.literal("").default(""), subject: z.literal("").default(""), url: z.literal("").default(""),
  assetIds: z.array(z.uuid()).max(0).default([]),
});
export const storyText = z.string().trim().min(3, "Tulis minimal 3 karakter.").max(500, "Maksimal 500 karakter.");
export const socialContextSchema = z.object({ roomId: z.string().min(1).max(80).default("umum"), parts: z.array(storyText).max(4, "Thread maksimal 5 bagian.").default([]) });
export const roomSchema = z.object({ name: z.string().trim().min(3).max(60), description: z.string().trim().min(3).max(280), rules: z.string().trim().min(3).max(1000) });
export const replySchema = z.object({ body: storyText, parentId: z.string().min(1).max(80).nullable().default(null) });
export const reasonSchema = z.object({ reason: z.string().trim().min(3, "Tambahkan alasan singkat.").max(500) });
