"use client";
import { useState } from "react";
import Image from "next/image";
import { BookOpen, Copy, Link2, Video } from "lucide-react";
import type { Post } from "@/lib/types";
import { kindLabels } from "@/lib/types";
import { Modal } from "./ui/dialog";
import { PostCard } from "./post-card";

export function PostGallery({ posts, onMessage }: { posts: Post[]; onMessage: (message: string) => void }) {
  const [selected, setSelected] = useState<Post | null>(null);
  return <><div className="post-grid" aria-label="Galeri kiriman">{posts.map(post => {
    const Icon = post.kind === "article" ? BookOpen : post.kind === "link" ? Link2 : post.kind === "video" ? Video : Copy;
    return <button key={post.id} className={`gallery-tile gallery-${post.kind}`} onClick={() => setSelected(post)} aria-label={`Buka ${kindLabels[post.kind]}: ${post.title || post.body.slice(0, 80)}`}>
      {post.kind === "photo" && post.assets[0] ? <Image src={post.assets[0].url} alt="" fill sizes="(max-width: 767px) 33vw, 200px" unoptimized /> : <span className="gallery-copy"><Icon size={24} aria-hidden="true" /><span className="gallery-kind">{kindLabels[post.kind]}</span><strong>{post.title || "Cerita kebaikan"}</strong></span>}
      {(post.kind !== "photo" || post.assets.length > 1) && <span className="gallery-type"><Icon size={16} aria-hidden="true" /></span>}
      {post.example && <span className="gallery-example">Contoh</span>}
    </button>;
  })}</div><Modal open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }} title="Kiriman" className="gallery-dialog">{selected && <PostCard key={`${selected.id}-${selected.revision}`} post={selected} onMessage={onMessage} articleFrom="gallery" />}</Modal></>;
}
