import { z } from "zod";
import { submissionSchema } from "./validation";

export const pollSubmissionSchema = z.object({
  kind: z.literal("poll"),
  title: z.string().trim().min(3, "Tambahkan pertanyaan polling.").max(160, "Pertanyaan maksimal 160 karakter."),
  body: z.string().trim().max(2000, "Deskripsi maksimal 2.000 karakter.").default(""),
  subject: z.literal("").default(""), url: z.literal("").default(""),
  assetIds: z.array(z.uuid()).max(0, "Polling tidak memakai unggahan.").default([]),
  poll: z.object({
    options: z.array(z.object({
      id: z.uuid(), label: z.string().trim().min(1, "Isi setiap pilihan jawaban.").max(100, "Pilihan maksimal 100 karakter."),
    })).min(2, "Tambahkan minimal 2 pilihan.").max(12, "Maksimal 12 pilihan."),
    multiple: z.boolean().default(false),
  }),
}).superRefine((input, ctx) => {
  const labels = new Set<string>(); const ids = new Set<string>();
  input.poll.options.forEach((option, index) => {
    const label = option.label.toLocaleLowerCase("id");
    if (labels.has(label)) ctx.addIssue({ code: "custom", path: ["poll", "options", index, "label"], message: "Pilihan jawaban tidak boleh sama." });
    if (ids.has(option.id)) ctx.addIssue({ code: "custom", path: ["poll", "options", index, "id"], message: "Pilihan jawaban tidak valid." });
    labels.add(label); ids.add(option.id);
  });
});
export const previewSubmissionSchema = z.union([pollSubmissionSchema, submissionSchema]);
export const pollVoteSchema = z.object({ optionIds: z.array(z.uuid()).max(12) });
