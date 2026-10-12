"use client";
import { useState } from "react";
import Image from "next/image";
import { BarChart3, BookOpen, Copy, MessageCircle, Link2, Video } from "lucide-react";
import { feedKindLabels as kindLabels, type FeedPost as Post } from "@/lib/preview-types";
import { Modal } from "./ui/dialog";
import { PostCard } from "./post-card";

export function PostGallery({ posts, onMessage }: { posts: Post[]; onMessage: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = posts.find(post => post.id === selectedId) ?? null;
  return <><div className="post-grid" aria-label="Galeri kiriman">{posts.map(post => {
    const Icon = post.kind === "short" ? MessageCircle : post.kind === "poll" ? BarChart3 : post.kind === "article" ? BookOpen : post.kind === "link" ? Link2 : post.kind === "video" ? Video : Copy;
    return <button key={post.id} className={`gallery-tile gallery-${post.kind}`} onClick={() => setSelectedId(post.id)} aria-label={`Buka ${kindLabels[post.kind]}: ${post.title || post.body.slice(0, 80)}`}>
      {post.kind === "photo" && post.assets[0] ? <Image src={post.assets[0].url} alt="" fill sizes="(max-width: 767px) 33vw, 200px" unoptimized /> : <span className="gallery-copy"><Icon size={24} aria-hidden="true" /><span className="gallery-kind">{kindLabels[post.kind]}</span><strong>{post.title || (post.kind === "short" ? post.body.slice(0, 110) : "Cerita kebaikan")}</strong></span>}
      {(post.kind !== "photo" || post.assets.length > 1) && <span className="gallery-type"><Icon size={16} aria-hidden="true" /></span>}
      {post.example && <span className="gallery-example">Contoh</span>}
    </button>;
  })}</div><Modal open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }} title="Kiriman" className="gallery-dialog">{selected && <PostCard key={`${selected.id}-${selected.revision}`} post={selected} onMessage={onMessage} articleFrom="gallery" back="/?view=gallery" />}</Modal></>;
}
