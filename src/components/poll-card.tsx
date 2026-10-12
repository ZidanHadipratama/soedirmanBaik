"use client";
import { useState } from "react";
import { BarChart3, Check, LockKeyhole } from "lucide-react";
import type { PollPost } from "@/lib/preview-types";
import { api, cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";

export function PollCard({ post, scope, onMessage }: { post: PollPost; scope: "feed" | "mine" | "admin"; onMessage: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const { poll } = post;
  const available = post.status === "approved" && !poll.closed;
  async function vote(id: string) {
    if (!available || busy) return;
    const selected = poll.ballot.includes(id);
    const optionIds = poll.multiple ? selected ? poll.ballot.filter(value => value !== id) : [...poll.ballot, id] : selected ? [] : [id];
    setBusy(true); setError("");
    try {
      await api(`/api/posts/${post.id}/vote`, { method: "POST", body: JSON.stringify({ optionIds }) });
      setFeedback(optionIds.length ? "Pilihan tersimpan." : "Pilihan dibatalkan.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function close() {
    setBusy(true); setError("");
    try {
      await api(`/api/posts/${post.id}/close`, { method: "POST", body: "{}" });
      setClosing(false); onMessage("Polling ditutup.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="poll-card" aria-labelledby={`poll-question-${post.id}`}>
    <span className="content-type"><BarChart3 size={16} aria-hidden="true" />Polling{poll.closed && <span className="poll-closed"><LockKeyhole size={13} aria-hidden="true" />Polling ditutup</span>}</span>
    <h2 id={`poll-question-${post.id}`}>{post.title}</h2>
    {post.body && <p className="poll-description">{post.body}</p>}
    <p className="poll-hint" id={`poll-hint-${post.id}`}>{poll.multiple ? "Boleh pilih beberapa jawaban." : "Pilih satu jawaban."}{available && " Ketuk lagi untuk membatalkan."}</p>
    <div className="poll-options" role="group" aria-label="Pilihan jawaban" aria-describedby={`poll-hint-${post.id}`} aria-busy={busy}>
      {poll.options.map(option => {
        const selected = poll.ballot.includes(option.id);
        const percentage = poll.participants ? Math.round(option.votes / poll.participants * 100) : 0;
        return <button type="button" className={cn("poll-option", selected && "is-selected")} key={option.id} aria-pressed={selected} disabled={!available || busy} onClick={() => void vote(option.id)} aria-label={`${option.label}, ${option.votes} suara, ${percentage}%`}>
          <span className="poll-option-bar" style={{ transform: `scaleX(${percentage / 100})` }} aria-hidden="true" />
          <span className={cn("poll-option-check", poll.multiple && "multiple")} aria-hidden="true">{selected && <Check size={15} />}</span>
          <span className="poll-option-label">{option.label}<span className="poll-option-count">{option.votes} suara</span></span>
          <span className="poll-option-percentage">{percentage}%</span>
        </button>;
      })}
    </div>
    <p className="poll-total">{poll.participants} peserta</p>
    {post.status !== "approved" && <p className="poll-hint">Voting tersedia setelah polling terbit.</p>}
    {scope === "mine" && available && <Button variant="secondary" className="small-button" onClick={() => { setError(""); setClosing(true); }} disabled={busy}><LockKeyhole size={16} />Tutup polling</Button>}
    <span className="sr-only" role="status" aria-live="polite">{feedback}</span>
    {!closing && error && <p role="alert" className="field-error">{error}</p>}
    <Modal open={closing} onOpenChange={open => { if (!busy) setClosing(open); }} title="Tutup polling?" description="Pilihan tidak bisa diubah lagi. Hasil polling tetap terlihat.">
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="poll-close-actions"><Button variant="secondary" onClick={() => setClosing(false)} disabled={busy}>Batal</Button><Button onClick={() => void close()} disabled={busy}>{busy ? "Menutup…" : "Tutup polling"}</Button></div>
    </Modal>
  </section>;
}
