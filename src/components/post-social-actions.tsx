"use client";
import { useState } from "react";
import Link from "next/link";
import { Bookmark, MessageCircle } from "lucide-react";
import type { FeedPost } from "@/lib/preview-types";
import { api, cn } from "@/lib/utils";

export function PostSocialActions({ post, back = "/", onMessage, discussionOpen = false }: { post: FeedPost; back?: string; discussionOpen?: boolean; onMessage: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await api(`/api/posts/${post.id}/save`, { method: "POST", body: "{}" }); }
    catch (e) { onMessage((e as Error).message); } finally { setBusy(false); }
  }
  if (process.env.NEXT_PUBLIC_UI_PREVIEW !== "true" || !post.social) return null;
  const href = `/diskusi?id=${encodeURIComponent(post.id)}&back=${encodeURIComponent(back)}`;
  return <div className="post-social-actions">
    {!discussionOpen && <Link href={href} className="discussion-link"><MessageCircle size={20} aria-hidden="true" /><span>{post.status === "approved" ? `Balas${post.social.replyCount ? ` · ${post.social.replyCount}` : ""}` : "Lihat thread"}</span>{post.social.partCount > 1 && <span className="thread-count">{post.social.partCount} bagian</span>}</Link>}
    {post.status === "approved" && <button className={cn("save-button", post.social.saved && "is-saved")} onClick={() => void save()} disabled={busy} aria-pressed={post.social.saved} aria-label={post.social.saved ? "Batalkan simpan" : "Simpan kiriman"}><Bookmark size={20} fill={post.social.saved ? "currentColor" : "none"} /></button>}
  </div>;
}
