"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MyReply } from "@/lib/preview-types";
import { api, relativeDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { usePreviewChange } from "./use-preview-change";

export function MyReplies({ onMessage }: { onMessage: (message: string) => void }) {
  const [replies, setReplies] = useState<MyReply[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try { const result = await api<{ replies: MyReply[] }>("/api/replies", { signal }); setReplies(result.replies); setError(""); }
    catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  usePreviewChange(useCallback(() => { void load(); }, [load]));
  async function remove(id: string) { setBusy(id); try { await api(`/api/replies/${id}`, { method: "DELETE" }); onMessage("Balasan dihapus."); } catch (e) { onMessage((e as Error).message); } finally { setBusy(""); } }
  return <div className="personal-replies">{loading ? <p role="status" className="section-feedback">Memuat balasan…</p> : error ? <p role="alert" className="field-error">{error}</p> : replies.length ? replies.map(reply => <article className="personal-reply" key={reply.id}>
    {reply.accessible ? <Link className="personal-reply-context" href={`/diskusi?id=${encodeURIComponent(reply.postId)}&back=${encodeURIComponent("/?view=mine&tab=replies")}`}>{reply.postTitle}</Link> : <span className="personal-reply-context">Diskusi tidak tersedia</span>}
    <time dateTime={reply.createdAt}>{relativeDate(reply.createdAt)}</time><p>{reply.deleted ? "Balasan dihapus." : reply.body}</p>
    {!reply.deleted && <Button variant="secondary" className="small-button" disabled={busy === reply.id} onClick={() => void remove(reply.id)}>Hapus balasan</Button>}
  </article>) : <p className="section-feedback">Belum ada balasanmu.</p>}</div>;
}
