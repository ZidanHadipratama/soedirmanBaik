"use client";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, Check, ImagePlus, Link2, Shield, Upload, Video, X } from "lucide-react";
import { feedKinds as POST_KINDS, feedKindLabels as kindLabels, type FeedPost as Post, type FeedKind as PostKind } from "@/lib/preview-types";
import { pollSubmissionSchema } from "@/lib/poll-validation";
import { api, cn } from "@/lib/utils";
import { submissionSchema, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/validation";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { PollEditor } from "./poll-editor";

type UploadItem = { id: string; url: string; status: string };
const kindIcons = { photo: ImagePlus, video: Video, article: BookOpen, link: Link2, poll: BarChart3 };
function uploadRequest(url: string, method: "POST" | "PUT", data: FormData | File, progress: (n: number) => void): Promise<Record<string, unknown>> {
  if (process.env.NEXT_PUBLIC_UI_PREVIEW === "true") {
    progress(100);
    return api<Record<string, unknown>>(url, { method, body: data });
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open(method, url);
    request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    request.onerror = () => reject(new Error("Koneksi terputus. Coba unggah lagi."));
    request.timeout = 180000; request.ontimeout = () => reject(new Error("Unggahan terlalu lama. Coba lagi."));
    request.onload = () => {
      let result: Record<string, unknown> = {}; try { result = JSON.parse(request.responseText || "{}"); } catch {}
      if (request.status >= 200 && request.status < 300) resolve(result); else reject(new Error(String(result.error ?? "Unggahan gagal. Coba lagi.")));
    };
    request.send(data);
  });
}
async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file); const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * factor); canvas.height = Math.round(bitmap.height * factor);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Foto tidak dapat dibaca.")), "image/webp", 0.84));
  return new File([blob], "foto.webp", { type: "image/webp" });
}
export function Composer({ open, onOpenChange, onSubmitted, editing, backend }: { open: boolean; onOpenChange: (value: boolean) => void; onSubmitted: () => void; editing: Post | null; backend: string }) {
  const [kind, setKind] = useState<PostKind>(editing?.kind ?? "photo");
  const [subject, setSubject] = useState(editing?.subject ?? ""); const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? ""); const [url, setUrl] = useState(editing?.url ?? "");
  const [uploads, setUploads] = useState<UploadItem[]>(editing?.assets.map(a => ({ id: a.id, url: a.url, status: a.status })) ?? []);
  const [uploading, setUploading] = useState(false); const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState("");
  const [pollOptions, setPollOptions] = useState(() => editing?.kind === "poll" ? editing.poll.options.map(({ id, label }) => ({ id, label })) : Array.from({ length: 2 }, () => ({ id: crypto.randomUUID(), label: "" })));
  const [multiple, setMultiple] = useState(editing?.kind === "poll" ? editing.poll.multiple : false);
  const [pollErrors, setPollErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const newUploads = useRef(new Set<string>()); const submitted = useRef(false);
  useEffect(() => () => { if (!submitted.current) for (const id of newUploads.current) void api(`/api/uploads/${id}`, { method: "DELETE" }).catch(() => {}); }, []);
  async function remove(item: UploadItem) {
    setUploads(current => current.filter(u => u.id !== item.id));
    if (newUploads.current.has(item.id)) { await api(`/api/uploads/${item.id}`, { method: "DELETE" }).catch(() => {}); newUploads.current.delete(item.id); }
  }
  async function changeKind(next: PostKind) {
    if (next === kind || uploading) return;
    for (const item of uploads) await remove(item);
    setKind(next); setError(""); setPollErrors({});
  }
  async function choose(files: FileList | null) {
    if (!files?.length) return;
    const selected = [...files]; const limit = kind === "video" ? 1 : 4;
    if (selected.length + uploads.length > limit) { setError(kind === "video" ? "Pilih satu video." : "Maksimal 4 foto."); return; }
    setUploading(true); setError("");
    try {
      for (let file of selected) {
        const isVideo = kind === "video";
        if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) throw new Error(isVideo ? "Video maksimal 50 MB." : "Foto maksimal 10 MB.");
        if (isVideo && !["video/mp4", "video/webm"].includes(file.type)) throw new Error("Gunakan MP4 atau WebM.");
        if (!isVideo && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Gunakan foto JPG, PNG, atau WebP.");
        setProgress(0);
        let result: UploadItem;
        if (isVideo && backend === "supabase") {
          const upload = await api<{ asset: { id: string }; uploadUrl: string }>("/api/uploads/video", { method: "POST", body: "{}" });
          newUploads.current.add(upload.asset.id);
          await uploadRequest(upload.uploadUrl, "PUT", file, setProgress);
          result = { id: upload.asset.id, url: "", status: "processing" };
        } else {
          if (!isVideo) file = await compressImage(file);
          const form = new FormData(); form.set("file", file);
          result = await uploadRequest("/api/uploads", "POST", form, setProgress) as unknown as UploadItem;
          newUploads.current.add(result.id);
        }
        setUploads(current => [...current, result]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setPollErrors({});
    const input = kind === "poll" ? { kind, subject: "", title, body, url: "", assetIds: [], poll: { options: pollOptions, multiple } } : { kind, subject, title, body, url, assetIds: uploads.map(u => u.id) };
    const parsed = (kind === "poll" ? pollSubmissionSchema : submissionSchema).safeParse(input);
    if (!parsed.success) {
      if (kind === "poll") setPollErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message])));
      else setError(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try { await api(editing ? `/api/posts/${editing.id}` : "/api/posts", { method: editing ? "PUT" : "POST", body: JSON.stringify(parsed.data) }); submitted.current = true; setDone(true); onSubmitted(); }
    catch (e) { setError((e as Error).message); } finally { setSubmitting(false); }
  }
  return <Modal open={open} onOpenChange={value => { if (!uploading && !submitting) onOpenChange(value); }} title={done ? "Kiriman terkirim" : editing ? "Perbaiki kiriman" : "Bagikan kebaikan"} description={done ? undefined : "Nama pengirim tidak ditampilkan."} className="composer-dialog">
    {done ? <div className="submission-success"><span className="success-icon"><Check size={32} /></span><h3>Menunggu review.</h3><p>Cek status di Kiriman saya.</p><Button className="full-width" onClick={() => onOpenChange(false)}>Selesai</Button></div> : <form onSubmit={submit} className="composer-form">
      <div className={cn("kind-picker", process.env.NEXT_PUBLIC_UI_PREVIEW === "true" && "with-poll")} role="group" aria-label="Jenis kiriman">{POST_KINDS.map(value => { const Icon = kindIcons[value]; return <button type="button" key={value} aria-pressed={kind === value} disabled={uploading || submitting || Boolean(editing)} className={cn("kind-option", kind === value && "selected")} onClick={() => void changeKind(value)}><Icon size={20} /><span>{kindLabels[value]}</span></button>; })}</div>
      {["photo", "video"].includes(kind) && <div className="upload-section"><input ref={fileInput} id="media-upload" className="sr-only" type="file" multiple={kind === "photo"} accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"} onChange={e => void choose(e.target.files)} disabled={uploading || submitting} aria-label={kind === "photo" ? "Pilih foto" : "Pilih video"} />
        {uploads.length > 0 && <div className="upload-previews">{uploads.map(item => <div className="upload-preview" key={item.id}>{kind === "photo" ? <div style={{ backgroundImage: `url('${item.url}')` }} role="img" aria-label="Foto yang dipilih" /> : <div className="video-upload-preview"><Video size={24} /><span>{item.status === "processing" ? "Memproses video" : "Video siap"}</span></div>}<button type="button" className="remove-upload" aria-label="Hapus unggahan" disabled={uploading || submitting} onClick={() => void remove(item)}><X size={16} /></button></div>)}</div>}
        {uploads.length < (kind === "photo" ? 4 : 1) && <button type="button" className="upload-target" disabled={uploading || submitting} onClick={() => fileInput.current?.click()}><span className="upload-icon"><Upload size={23} /></span><strong>{uploading ? "Mengunggah…" : kind === "photo" ? "Pilih foto" : "Pilih video"}</strong><span>{kind === "photo" ? "JPG, PNG, WebP · hingga 4 foto" : "MP4, WebM · maksimal 50 MB"}</span></button>}
        {uploading && <div className="upload-progress"><progress value={progress} max={100} aria-label="Progres unggahan" /><span>{progress}%</span></div>}
      </div>}
      {kind === "link" && <label className="field">Tautan<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" required maxLength={2000} autoComplete="url" /></label>}
      {["article", "link", "poll"].includes(kind) && <label className="field">{kind === "poll" ? "Pertanyaan" : "Judul"}{kind === "link" && <span className="optional">opsional</span>}<input aria-label={kind === "poll" ? "Pertanyaan" : "Judul"} value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === "poll" ? "Kegiatan sosial berikutnya?" : kind === "article" ? "Judul ceritamu" : "Nama website atau kontribusi"} required={kind !== "link"} maxLength={kind === "poll" ? 160 : 120} aria-invalid={Boolean(pollErrors.title)} aria-describedby={pollErrors.title ? "poll-question-error" : undefined} />{pollErrors.title && <span id="poll-question-error" className="field-error" role="alert">{pollErrors.title}</span>}</label>}
      {kind === "poll" && <PollEditor options={pollOptions} multiple={multiple} disabled={submitting} errors={pollErrors} onOptionsChange={options => { setPollOptions(options); setPollErrors({}); }} onMultipleChange={setMultiple} />}
      <label className="field">{kind === "poll" ? "Deskripsi" : kind === "article" ? "Artikel" : "Cerita"}{kind === "poll" && <span className="optional">opsional</span>}<textarea aria-label={kind === "poll" ? "Deskripsi" : kind === "article" ? "Artikel" : "Cerita"} value={body} onChange={e => setBody(e.target.value)} aria-describedby={kind === "article" ? "markdown-hint" : pollErrors.body ? "poll-body-error" : undefined} aria-invalid={Boolean(pollErrors.body)} placeholder={kind === "poll" ? "Tambahkan konteks singkat…" : kind === "article" ? "## Awal cerita\n\nCeritakan kebaikannya…" : "Ceritakan kebaikannya…"} rows={kind === "article" ? 7 : 3} required={kind !== "poll"} minLength={kind === "poll" ? undefined : 3} maxLength={kind === "article" ? 10000 : 2000} />{kind === "article" && <span className="field-hint" id="markdown-hint">Gunakan Markdown: ## judul, **tebal**, - daftar, dan [tautan](https://…).</span>}{pollErrors.body && <span id="poll-body-error" role="alert" className="field-error">{pollErrors.body}</span>}<span className="character-count" aria-hidden="true">{body.length}/{kind === "article" ? "10.000" : "2.000"}</span></label>
      {kind !== "poll" && <label className="field">Untuk siapa?<span className="optional">opsional</span><input aria-label="Untuk siapa?" aria-describedby="subject-hint" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Nama orang yang ingin diapresiasi" maxLength={80} /><span className="field-hint" id="subject-hint">Pastikan ia nyaman disebut.</span></label>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="composer-footer"><span><Shield size={14} />Direview sebelum terbit</span><Button type="submit" disabled={uploading || submitting}>{submitting ? "Mengirim…" : "Kirim"}</Button></div>
    </form>}
  </Modal>;
}
