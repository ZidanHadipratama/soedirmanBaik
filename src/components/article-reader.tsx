"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, Shield } from "lucide-react";
import type { Post } from "@/lib/types";
import { api } from "@/lib/utils";
import { Markdown } from "./markdown";

export function ArticleReader() {
  const params = useSearchParams();
  const id = params.get("id");
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const back = params.get("from") === "gallery" ? "/?view=gallery" : params.get("from") === "mine" ? "/?view=mine" : params.get("from") === "admin" ? "/admin" : "/";
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setPost(null); setError("");
    if (!id) { setError("Artikel tidak ditemukan."); setLoading(false); return; }
    api<Post>(`/api/posts/${encodeURIComponent(id)}`, { signal: controller.signal }).then(result => {
      if (result.kind !== "article") throw new Error("Artikel tidak ditemukan.");
      setPost(result);
    }).catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);
  return <main className="article-page" id="main-content">
    <Link className="article-back" href={back}><ArrowLeft size={20} aria-hidden="true" />Kembali ke {back === "/admin" ? "review" : back.includes("gallery") ? "galeri" : back.includes("mine") ? "kiriman saya" : "beranda"}</Link>
    {loading ? <p role="status" className="article-feedback">Memuat artikel…</p> : error ? <div className="article-feedback"><h1>Artikel belum tersedia.</h1><p role="alert">{error}</p></div> : post && <article>
      <header className="article-page-heading"><span className="content-type"><BookOpen size={16} aria-hidden="true" />Artikel {post.example && <span className="example-badge">Contoh</span>}</span><h1>{post.title}</h1>
        <div className="article-meta"><Shield size={16} aria-hidden="true" /><span>Anonim</span><time dateTime={post.publishedAt ?? post.createdAt}>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(post.publishedAt ?? post.createdAt))}</time><span>{Math.max(1, Math.ceil(post.body.split(/\s+/).length / 200))} menit baca</span></div>
        {post.subject && <p className="post-subject">Untuk <strong>{post.subject}</strong></p>}
      </header>
      <Markdown>{post.body}</Markdown>
    </article>}
  </main>;
}
