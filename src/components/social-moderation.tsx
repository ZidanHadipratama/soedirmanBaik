"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PartReview, ReportedReply } from "@/lib/preview-types";
import { api } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { usePreviewChange } from "./use-preview-change";

export function SocialModeration({ mode, onMessage }: { mode: "parts" | "replies"; onMessage: (message: string) => void }) {
  const [parts, setParts] = useState<PartReview[]>([]); const [replies, setReplies] = useState<ReportedReply[]>([]);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{ id: string; postId: string; revision?: number } | null>(null); const [reason, setReason] = useState(""); const [reviewError, setReviewError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try { const result = await api<{ parts?: PartReview[]; replies?: ReportedReply[] }>(`/api/admin/${mode}`, { signal }); setParts(result.parts ?? []); setReplies(result.replies ?? []); setError(""); }
    catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); } finally { if (!signal?.aborted) setLoading(false); }
  }, [mode]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); void load(controller.signal); return () => controller.abort(); }, [load]);
  usePreviewChange(useCallback(() => { void load(); }, [load]));
  async function approve(item: PartReview) {
    setBusy(true);
    try { await api(`/api/admin/posts/${item.post.id}/parts/${item.part.id}`, { method: "POST", body: JSON.stringify({ action: "approve", revision: item.part.revision }) }); onMessage("Lanjutan terbit."); }
    catch (e) { onMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!review) return; setBusy(true); setReviewError("");
    try {
      await api(mode === "parts" ? `/api/admin/posts/${review.postId}/parts/${review.id}` : `/api/admin/replies/${review.id}`, { method: mode === "parts" ? "POST" : "DELETE", body: JSON.stringify(mode === "parts" ? { action: "reject", reason, revision: review.revision } : { reason }) });
      setReview(null); onMessage(mode === "parts" ? "Lanjutan dikembalikan." : "Balasan dihapus.");
    } catch (e) { setReviewError((e as Error).message); } finally { setBusy(false); }
  }
  function ask(value: NonNullable<typeof review>) { setReview(value); setReason(""); setReviewError(""); }
  if (loading) return <p className="section-feedback" role="status">Memuat review…</p>;
  if (error) return <p className="field-error" role="alert">{error}</p>;
  return <div className="social-review-list">
    {mode === "parts" ? parts.length ? parts.map(item => <article className="social-review-card" key={item.part.id}><Link href={`/diskusi?id=${encodeURIComponent(item.post.id)}&back=${encodeURIComponent(`/admin?section=${mode}`)}`}>Lihat kiriman utama</Link><p>{item.part.body}</p>{item.post.status !== "approved" && <p className="field-hint">Kiriman utama belum terbit.</p>}<div className="moderation-actions"><Button disabled={busy || item.post.status !== "approved"} onClick={() => void approve(item)}>Terbitkan lanjutan</Button><Button variant="secondary" disabled={busy} onClick={() => ask({ id: item.part.id, postId: item.post.id, revision: item.part.revision })}>Kembalikan lanjutan</Button></div></article>) : <p className="section-feedback">Tidak ada lanjutan menunggu review.</p> : replies.length ? replies.map(item => <article className="social-review-card" key={item.reply.id}><Link href={`/diskusi?id=${encodeURIComponent(item.post.id)}&back=${encodeURIComponent(`/admin?section=${mode}`)}`}>Lihat diskusi</Link><strong>{item.reply.author}</strong><p>{item.reply.body}</p><span className="report-count">{item.reply.reports} laporan</span>{item.reply.reportReasons?.map((reason, index) => <p className="review-reason" key={index}>{reason}</p>)}<Button variant="danger" disabled={busy} onClick={() => ask({ id: item.reply.id, postId: item.post.id })}>Sembunyikan balasan</Button></article>) : <p className="section-feedback">Tidak ada balasan dilaporkan.</p>}
    <Modal open={Boolean(review)} onOpenChange={open => { if (!open && !busy) setReview(null); }} title={mode === "parts" ? "Kembalikan lanjutan" : "Sembunyikan balasan"}><form onSubmit={submit}><label className="field">Alasan<textarea aria-label="Alasan" value={reason} onChange={e => setReason(e.target.value)} minLength={3} maxLength={500} required rows={3} /></label>{reviewError && <p role="alert" className="field-error">{reviewError}</p>}<Button type="submit" disabled={busy}>Simpan</Button></form></Modal>
  </div>;
}
