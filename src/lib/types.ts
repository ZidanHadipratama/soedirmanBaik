export const POST_KINDS = ["photo", "video", "article", "link"] as const;
export type PostKind = typeof POST_KINDS[number];
export type PostStatus = "pending" | "approved" | "rejected" | "hidden";
export type Asset = {
  id: string; ownerId: string; postId: string | null; provider: "local" | "supabase" | "mux";
  path: string; mime: string; size: number; status: "processing" | "ready" | "failed";
  uploadId: string | null; muxAssetId: string | null; playbackId: string | null;
  createdAt: string;
};
export type StoredPost = {
  id: string; ownerId: string; kind: PostKind; status: PostStatus; subject: string;
  title: string; body: string; url: string; createdAt: string; publishedAt: string | null;
  reason: string; example: boolean; revision: number;
};
export type PublicAsset = Pick<Asset, "id" | "provider" | "mime" | "status" | "playbackId"> & { url: string };
export type Post = Omit<StoredPost, "ownerId"> & { assets: PublicAsset[]; appreciations: number; appreciated: boolean; reports?: number };
export type Submission = { kind: PostKind; subject: string; title: string; body: string; url: string; assetIds: string[] };
export const kindLabels: Record<PostKind, string> = { photo: "Foto", video: "Video", article: "Artikel", link: "Tautan" };
export const statusLabels: Record<PostStatus, string> = { pending: "Menunggu review", approved: "Terbit", rejected: "Perlu diperbaiki", hidden: "Disembunyikan" };
