import type { Asset, PostKind, PostStatus, StoredPost } from "../types";
import { backend } from "./config";

export type PostQuery = { scope: "feed" | "mine" | "admin"; ownerId?: string; status?: PostStatus; kind?: PostKind; search?: string; offset?: number };
export type Moderation = { id: string; postId: string; action: string; reason: string; at: string };
export interface Store {
  listPosts(query: PostQuery): Promise<StoredPost[]>;
  getPost(id: string): Promise<StoredPost | null>;
  submit(post: StoredPost, assetIds: string[]): Promise<void>;
  moderate(id: string, revision: number, status: PostStatus, reason: string): Promise<void>;
  getAsset(id: string): Promise<Asset | null>;
  assetsForPost(id: string): Promise<Asset[]>;
  saveAsset(asset: Asset): Promise<void>;
  assetByUpload(id: string): Promise<Asset | null>;
  assetByMux(id: string): Promise<Asset | null>;
  removeAsset(id: string): Promise<void>;
  appreciation(id: string, guest: string | null): Promise<{ count: number; active: boolean }>;
  toggleAppreciation(id: string, guest: string): Promise<{ count: number; active: boolean }>;
  report(id: string, guest: string, reason: string): Promise<void>;
  reportCount(id: string): Promise<number>;
  consumeLimit(key: string, max: number, windowMs: number): Promise<boolean>;
}
export async function store(): Promise<Store> {
  return backend() === "local" ? (await import("./store-local")).localStore : (await import("./store-supabase")).supabaseStore;
}
