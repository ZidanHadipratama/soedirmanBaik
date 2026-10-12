"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Flag, Heart, MoreHorizontal, Pencil, Play, Shield, Video } from "lucide-react";
import type { PublicAsset } from "@/lib/types";
import { canEditPost, type FeedPost as Post } from "@/lib/preview-types";
import { PostSocialActions } from "./post-social-actions";
import { PollCard } from "./poll-card";
import { api, cn, relativeDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { StatusBadge } from "./status-badge";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), { ssr: false });
function VideoMedia({ asset }: { asset: PublicAsset }) {
  const [playback, setPlayback] = useState<{ playbackId: string; tokens: { playback: string; thumbnail: string; storyboard: string } } | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  if (asset.status !== "ready") return <div className="video-placeholder"><Video size={28} /><span>{asset.status === "failed" ? "Video gagal diproses." : "Video sedang diproses."}</span></div>;
  if (asset.provider !== "mux") return <video className="post-video" controls playsInline preload="metadata" src={asset.url} aria-label="Video kegiatan" />;
  async function load() { setLoading(true); setError(""); try { setPlayback(await api(`/api/video/${asset.id}`)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  if (!playback) return <div className="video-placeholder"><button className="video-play" onClick={load} disabled={loading} aria-label="Putar video"><Play fill="currentColor" size={28} /></button><span>{loading ? "Memuat video…" : "Putar video"}</span>{error && <p role="alert">{error}</p>}</div>;
  return <MuxPlayer playbackId={playback.playbackId} tokens={playback.tokens} streamType="on-demand" accentColor="#507899" className="post-video" />;
}
export function PostCard({ post, scope = "feed", onEdit, onReview, onMessage, articleFrom, back = "/", discussionOpen = false }: { post: Post; back?: string; discussionOpen?: boolean; articleFrom?: "gallery"; scope?: "feed" | "mine" | "admin"; onEdit?: (post: Post) => void; onReview?: (post: Post, action: "approve" | "reject" | "hide") => void; onMessage: (message: string) => void }) {
  const [index, setIndex] = useState(0); const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Tidak sesuai"); const [reportError, setReportError] = useState("");
  const [reportBusy, setReportBusy] = useState(false); const [likeBusy, setLikeBusy] = useState(false);
  const [likes, setLikes] = useState({ count: post.appreciations, active: post.appreciated });
  const asset = post.assets[index];
  async function appreciate() {
    if (likeBusy) return; setLikeBusy(true); const previous = likes;
    setLikes({ count: Math.max(0, likes.count + (likes.active ? -1 : 1)), active: !likes.active });
    try { setLikes(await api(`/api/posts/${post.id}/appreciate`, { method: "POST", body: "{}" })); }
    catch (e) { setLikes(previous); onMessage((e as Error).message); } finally { setLikeBusy(false); }
  }
  async function report() {
    setReportBusy(true); setReportError("");
    try { await api(`/api/posts/${post.id}/report`, { method: "POST", body: JSON.stringify({ reason: reportReason }) }); setReportOpen(false); onMessage("Laporan terkirim."); }
    catch (e) { setReportError((e as Error).message); } finally { setReportBusy(false); }
  }
  return <article className={cn("post-card", scope !== "feed" && "submission-card")}>
    <header className="post-header"><span className="anonymous-avatar"><Shield size={18} aria-hidden="true" /></span><div className="post-author"><strong>Anonim</strong><time dateTime={post.publishedAt ?? post.createdAt}>{relativeDate(post.publishedAt ?? post.createdAt)}</time></div>
      {post.example && <span className="example-badge">Contoh</span>}
      {scope === "feed" && <button className="icon-button more-button" aria-label="Laporkan kiriman" onClick={() => setReportOpen(true)}><MoreHorizontal size={22} /></button>}
      {scope !== "feed" && <StatusBadge status={post.status} />}
    </header>
    {process.env.NEXT_PUBLIC_UI_PREVIEW === "true" && post.social && <Link className="post-room" href={`/ruang?slug=${encodeURIComponent(post.social.room.slug)}`}>{post.social.room.name}</Link>}
    {post.kind === "photo" && asset && <div className="post-image"><Image src={asset.url} alt={post.body.slice(0, 160)} width={1080} height={1350} sizes="(max-width: 767px) 100vw, 600px" unoptimized />
      {post.assets.length > 1 && <><span className="photo-count" aria-live="polite">{index + 1}/{post.assets.length}</span><div className="carousel-controls"><button className="carousel-button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Foto sebelumnya"><ChevronLeft size={20} /></button><button className="carousel-button" disabled={index === post.assets.length - 1} onClick={() => setIndex(index + 1)} aria-label="Foto berikutnya"><ChevronRight size={20} /></button></div></>}
    </div>}
    {post.kind === "video" && asset && <VideoMedia asset={asset} />}
    {post.kind === "article" && <Link className="article-preview" href={`/articles?id=${encodeURIComponent(post.id)}&from=${articleFrom ?? scope}${back !== "/" ? `&back=${encodeURIComponent(back)}` : ""}`}><span className="content-type"><BookOpen size={16} />Artikel</span><h2>{post.title}</h2><p>{post.body.slice(0, 150)}{post.body.length > 150 ? "…" : ""}</p><span className="read-link">Baca artikel <ArrowUpRight size={18} /></span></Link>}
    {post.kind === "link" && <a className="link-preview" href={post.url} target="_blank" rel="noopener noreferrer"><span className="link-mark"><ArrowUpRight size={28} /></span><div><span className="content-type">{new URL(post.url).hostname.replace(/^www\./, "")}</span><h2>{post.title || "Kontribusi untuk sekitar"}</h2><span className="read-link">Buka website <ArrowUpRight size={16} /></span></div></a>}
    {post.kind === "poll" && <PollCard post={post} scope={scope} onMessage={onMessage} />}
    <div className="post-content">
      {post.status === "approved" && <div className="post-actions"><button className={cn("appreciate-button", likes.active && "is-appreciated")} onClick={appreciate} disabled={likeBusy} aria-pressed={likes.active} aria-label={likes.active ? "Batalkan apresiasi" : "Apresiasi kiriman"}><Heart size={24} fill={likes.active ? "currentColor" : "none"} /><span>{likes.count > 0 ? `${likes.count} apresiasi` : "Apresiasi"}</span></button>{Boolean(post.reports) && <span className="report-count"><Flag size={14} />{post.reports} laporan</span>}</div>}
      {post.subject && <p className="post-subject">Untuk <strong>{post.subject}</strong></p>}
      {post.kind !== "article" && post.kind !== "poll" && <><p className={cn("post-caption", !expanded && post.kind !== "short" && "clamped")}>{post.body}</p>{post.body.length > 170 && <button className="text-button" onClick={() => setExpanded(!expanded)}>{expanded ? "Ringkas" : "Selengkapnya"}</button>}</>}
      <PostSocialActions post={post} back={back} discussionOpen={discussionOpen} onMessage={onMessage} />
      {!discussionOpen && scope !== "feed" && post.social?.parts.filter(part => part.initial).map((part, i) => <div className="thread-part-preview" key={part.id}><span className="content-type">Bagian {i + 2}</span><p>{part.body}</p></div>)}
      {scope !== "feed" && post.reason && <div className="review-reason"><span>Catatan admin</span><p>{post.reason}</p></div>}
      {scope === "mine" && canEditPost(post) && <Button variant="secondary" className="small-button" onClick={() => onEdit?.(post)}><Pencil size={16} />{post.status === "rejected" ? "Perbaiki kiriman" : "Edit kiriman"}</Button>}
      {scope === "admin" && <div className="moderation-actions">{post.status === "pending" ? <><Button onClick={() => onReview?.(post, "approve")} disabled={post.assets.some(a => a.status !== "ready")}>Terbitkan</Button><Button variant="secondary" onClick={() => onReview?.(post, "reject")}>Kembalikan</Button></> : post.status === "approved" ? <Button variant="danger" onClick={() => onReview?.(post, "hide")}>Sembunyikan</Button> : null}</div>}
    </div>
    <Modal open={reportOpen} onOpenChange={v => { if (!reportBusy) setReportOpen(v); }} title="Laporkan kiriman" description="Laporan akan direview admin."><fieldset className="report-options"><legend className="sr-only">Alasan laporan</legend>{["Tidak sesuai", "Privasi orang lain", "Informasi tidak benar"].map(reason => <label key={reason}><input type="radio" name={`report-${post.id}`} value={reason} checked={reportReason === reason} onChange={() => setReportReason(reason)} />{reason}</label>)}</fieldset>{reportError && <p className="field-error" role="alert">{reportError}</p>}<Button className="full-width" onClick={report} disabled={reportBusy}>{reportBusy ? "Mengirim…" : "Kirim laporan"}</Button></Modal>
  </article>;
}
