"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, LockKeyhole, MessageCircle, Trash2 } from "lucide-react";
import type { FeedPost, Reply, ThreadDetail, ThreadPart } from "@/lib/preview-types";
import { api, cn, relativeDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { PostCard } from "./post-card";
import { StatusBadge } from "./status-badge";
import { usePreviewChange } from "./use-preview-change";

type Confirmation = { action: "delete" | "report" | "hide" | "reject"; id: string; revision?: number };
export function ThreadView({ id, back, onMessage, onEdit, onReview }: { id: string | null; back: string; onMessage: (message: string) => void; onEdit: (post: FeedPost) => void; onReview: (post: FeedPost, action: "approve" | "reject" | "hide") => void }) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [replyBody, setReplyBody] = useState(""); const [target, setTarget] = useState<Reply | null>(null); const [replyError, setReplyError] = useState("");
  const [partBody, setPartBody] = useState(""); const [editingPart, setEditingPart] = useState<string | null>(null); const [partError, setPartError] = useState("");
  const [busy, setBusy] = useState(false); const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null); const [reason, setReason] = useState(""); const [confirmError, setConfirmError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!id) { setError("Diskusi tidak ditemukan."); setLoading(false); return; }
    try { const result = await api<ThreadDetail>(`/api/posts/${encodeURIComponent(id)}/thread`, { signal }); setDetail(result); setError(""); }
    catch (e) { if ((e as Error).name !== "AbortError") { setDetail(null); setError((e as Error).message); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [id]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); void load(controller.signal); return () => controller.abort(); }, [load]);
  usePreviewChange(useCallback(() => { void load(); }, [load]), id ?? undefined);
  function ask(action: Confirmation["action"], value: string, revision?: number) { setReason(""); setConfirmError(""); setConfirmation({ action, id: value, revision }); }
  async function sendReply(event: React.FormEvent) {
    event.preventDefault(); if (!id || busy) return; setBusy(true); setReplyError("");
    try { await api(`/api/posts/${id}/replies`, { method: "POST", body: JSON.stringify({ body: replyBody, parentId: target?.id ?? null }) }); setReplyBody(""); setTarget(null); onMessage("Balasan terkirim."); }
    catch (e) { setReplyError((e as Error).message); } finally { setBusy(false); }
  }
  async function sendPart(event: React.FormEvent) {
    event.preventDefault(); if (!id || busy) return; setBusy(true); setPartError("");
    try { await api(`/api/posts/${id}/parts${editingPart ? `/${editingPart}` : ""}`, { method: editingPart ? "PUT" : "POST", body: JSON.stringify({ body: partBody }) }); setPartBody(""); setEditingPart(null); onMessage("Lanjutan menunggu review."); }
    catch (e) { setPartError((e as Error).message); } finally { setBusy(false); }
  }
  async function approve(part: ThreadPart) {
    setBusy(true);
    try { await api(`/api/admin/posts/${id}/parts/${part.id}`, { method: "POST", body: JSON.stringify({ action: "approve", revision: part.revision }) }); onMessage("Lanjutan terbit."); }
    catch (e) { onMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function lock() {
    if (!detail) return; setBusy(true);
    try { await api(`/api/admin/posts/${id}/lock`, { method: "POST", body: JSON.stringify({ locked: !detail.post.social?.locked }) }); onMessage(detail.post.social?.locked ? "Diskusi dibuka." : "Diskusi dikunci."); }
    catch (e) { onMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function confirm(event: React.FormEvent) {
    event.preventDefault(); if (!confirmation) return; setBusy(true); setConfirmError("");
    const action = confirmation.action;
    const path = action === "reject" ? `/api/admin/posts/${id}/parts/${confirmation.id}` : action === "hide" ? `/api/admin/replies/${confirmation.id}` : `/api/replies/${confirmation.id}${action === "report" ? "/report" : ""}`;
    try {
      await api(path, { method: action === "hide" || action === "delete" ? "DELETE" : "POST", body: JSON.stringify(action === "reject" ? { action: "reject", reason, revision: confirmation.revision } : { reason }) });
      setConfirmation(null); onMessage(action === "report" ? "Laporan terkirim." : action === "reject" ? "Lanjutan dikembalikan." : "Balasan dihapus.");
    } catch (e) { setConfirmError((e as Error).message); } finally { setBusy(false); }
  }
  function renderReply(reply: Reply, nested = false) {
    const available = detail?.post.status === "approved" && !detail.post.social?.locked;
    return <article className={cn("discussion-reply", nested && "nested", reply.deleted && "deleted")} key={reply.id} data-reply-id={reply.id}>
      <header><strong>{reply.author}</strong>{reply.owned && <span className="reply-badge">Anda</span>}<time dateTime={reply.createdAt}>{relativeDate(reply.createdAt)}</time></header>
      {reply.replyingTo && !reply.deleted && <span className="reply-target">Membalas {reply.replyingTo}</span>}
      <p>{reply.deleted ? "Balasan dihapus." : reply.body}</p>
      {!reply.deleted && <div className="reply-actions">
        {available && <button className="text-button" onClick={() => { setTarget(reply); setReplyError(""); document.getElementById("reply-body")?.focus(); }}>Balas {reply.author}</button>}
        {reply.owned ? <button className="icon-button" aria-label="Hapus balasan" onClick={() => ask("delete", reply.id)}><Trash2 size={16} /></button> : <button className="icon-button" aria-label={reply.reported ? "Balasan dilaporkan" : "Laporkan balasan"} disabled={reply.reported || detail?.post.status !== "approved"} onClick={() => ask("report", reply.id)}><Flag size={16} /></button>}
        {detail?.admin && <button className="text-button" onClick={() => ask("hide", reply.id)}>Sembunyikan balasan</button>}
      </div>}
    </article>;
  }
  const available = detail?.post.status === "approved" && !detail.post.social?.locked;
  const needsReason = confirmation?.action !== "delete";
  return <div className="thread-view"><Link className="context-back" href={back}><ArrowLeft size={18} aria-hidden="true" />Kembali</Link>
    {loading ? <p className="section-feedback" role="status">Memuat diskusi…</p> : error ? <div className="section-feedback"><p role="alert">{error}</p><Button variant="secondary" onClick={() => void load()}>Coba lagi</Button></div> : detail && <>
      {detail.admin && detail.post.status === "approved" && <div className="discussion-admin"><span>Kontrol admin</span><Button variant="secondary" className="small-button" disabled={busy} onClick={() => void lock()}><LockKeyhole size={16} />{detail.post.social?.locked ? "Buka diskusi" : "Kunci diskusi"}</Button></div>}
      <PostCard post={detail.post} scope={detail.owned ? "mine" : detail.admin ? "admin" : "feed"} onMessage={onMessage} onEdit={onEdit} onReview={onReview} back={`/diskusi?id=${encodeURIComponent(detail.post.id)}&back=${encodeURIComponent(back)}`} discussionOpen />
      {detail.parts.length > 0 && <section className="thread-parts" aria-label="Lanjutan penulis">{detail.parts.map((part, index) => <article className="thread-part" key={part.id}>
        <header><strong>Penulis</strong><span>Bagian {index + 2}</span>{part.status !== "approved" && <StatusBadge status={part.status} />}</header><p>{part.body}</p>
        {part.reason && <p className="review-reason">{part.reason}</p>}
        {detail.owned && part.status === "rejected" && available && <Button variant="secondary" className="small-button" onClick={() => { setEditingPart(part.id); setPartBody(part.body); setPartError(""); }}>Perbaiki lanjutan</Button>}
        {detail.admin && part.status === "pending" && !part.initial && detail.post.status === "approved" && <div className="moderation-actions"><Button className="small-button" disabled={busy} onClick={() => void approve(part)}>Terbitkan lanjutan</Button><Button className="small-button" variant="secondary" disabled={busy} onClick={() => ask("reject", part.id, part.revision)}>Kembalikan lanjutan</Button></div>}
      </article>)}</section>}
      {detail.owned && available && (detail.parts.length < 4 || editingPart) && <form className="part-compose" onSubmit={sendPart}><h2>{editingPart ? "Perbaiki lanjutan" : "Tambah lanjutan"}</h2><label className="field">Lanjutan<textarea aria-label="Lanjutan" value={partBody} onChange={e => setPartBody(e.target.value)} required minLength={3} maxLength={500} disabled={busy} rows={3} /><span className="character-count" aria-hidden="true">{partBody.length}/500</span></label>{partError && <p role="alert" className="field-error">{partError}</p>}<div className="room-form-actions">{editingPart && <Button type="button" variant="secondary" onClick={() => { setEditingPart(null); setPartBody(""); }}>Batal</Button>}<Button type="submit" disabled={busy}>Kirim lanjutan</Button></div><p className="field-hint">Lanjutan direview sebelum tampil.</p></form>}
      <section className="discussion-section" aria-labelledby="reply-heading"><h2 id="reply-heading"><MessageCircle size={21} aria-hidden="true" />Balasan <span>{detail.post.social?.replyCount ?? 0}</span></h2>
        {detail.post.social?.locked && <p className="discussion-locked" role="status"><LockKeyhole size={18} aria-hidden="true" />Diskusi dikunci. Balasan dan lanjutan baru dihentikan.</p>}
        {detail.post.status !== "approved" && <p className="discussion-locked">Diskusi tersedia setelah kiriman terbit.</p>}
        {detail.replies.length ? detail.replies.filter(reply => !reply.parentId).map(reply => {
          const children = detail.replies.filter(value => value.parentId === reply.id);
          return <div className="reply-group" key={reply.id}>{renderReply(reply)}{children.length > 0 && <>
            <button className="reply-collapse text-button" aria-expanded={!collapsed.has(reply.id)} onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(reply.id)) next.delete(reply.id); else next.add(reply.id); return next; })}>{collapsed.has(reply.id) ? "Tampilkan" : "Ringkas"} {children.length} balasan</button>
            {!collapsed.has(reply.id) && <div className="nested-replies">{children.map(child => renderReply(child, true))}</div>}
          </>}</div>;
        }) : <p className="section-feedback">Belum ada balasan. Mulai percakapan yang baik.</p>}
        {available && <form className="reply-compose" onSubmit={sendReply}>
          {target && <div className="replying-banner"><span>Membalas {target.author}</span><button type="button" className="text-button" onClick={() => setTarget(null)}>Batalkan balasan</button></div>}
          <label className="field" htmlFor="reply-body">Balasan</label><textarea id="reply-body" aria-label="Balasan" value={replyBody} onChange={e => setReplyBody(e.target.value)} required minLength={3} maxLength={500} rows={3} disabled={busy} placeholder="Tulis balasan yang membantu…" />
          <p className="field-hint">Identitasmu ditandai anonim dalam diskusi ini.</p>{replyError && <p className="field-error" role="alert">{replyError}</p>}<Button type="submit" disabled={busy}>Kirim balasan</Button>
        </form>}
      </section>
    </>}
    <Modal open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }} title={confirmation?.action === "report" ? "Laporkan balasan" : confirmation?.action === "reject" ? "Kembalikan lanjutan" : "Hapus balasan?"} description={confirmation?.action === "delete" ? "Balasan turunannya tetap terlihat." : "Catatan ini hanya untuk moderasi."}>
      <form onSubmit={confirm}>{needsReason && <label className="field">Alasan<textarea aria-label="Alasan" value={reason} onChange={e => setReason(e.target.value)} required minLength={3} maxLength={500} rows={3} /></label>}{confirmError && <p className="field-error" role="alert">{confirmError}</p>}<div className="room-form-actions"><Button variant="secondary" type="button" onClick={() => setConfirmation(null)} disabled={busy}>Batal</Button><Button variant={confirmation?.action === "delete" || confirmation?.action === "hide" ? "danger" : "primary"} type="submit" disabled={busy}>{busy ? "Menyimpan…" : confirmation?.action === "report" ? "Kirim laporan" : confirmation?.action === "reject" ? "Kembalikan" : "Hapus balasan"}</Button></div></form>
    </Modal>
  </div>;
}
