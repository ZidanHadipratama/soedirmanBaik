"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Heart, Home, Inbox, LockKeyhole, LogOut, Plus, Search, Shield, X } from "lucide-react";
import { POST_KINDS, kindLabels, type Post, type PostKind, type PostStatus } from "@/lib/types";
import { api, cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Composer } from "./composer";
import { PostCard } from "./post-card";

type View = "feed" | "mine" | "admin";
function Brand() { return <Link href="/" className="brand" aria-label="Soedirman Baik, beranda"><span className="brand-symbol"><Heart size={25} fill="currentColor" strokeWidth={1.5} /></span><span>soedirman<span className="brand-second">baik<span className="brand-period">.</span></span></span></Link>; }

export function CommunityApp({ initialView = "feed" }: { initialView?: View }) {
  const router = useRouter(); const params = useSearchParams();
  const view: View = initialView === "admin" ? "admin" : params.get("view") === "mine" ? "mine" : "feed";
  const [posts, setPosts] = useState<Post[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [kind, setKind] = useState<PostKind | "all">("all"); const [search, setSearch] = useState(""); const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false); const [editing, setEditing] = useState<Post | null>(null);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [session, setSession] = useState<{ admin: boolean; backend: string } | null>(null);
  const [password, setPassword] = useState(""); const [loginError, setLoginError] = useState(""); const [loginBusy, setLoginBusy] = useState(false);
  const [adminFilter, setAdminFilter] = useState<PostStatus | "reported">("pending");
  const [review, setReview] = useState<{ post: Post; action: "reject" | "hide" } | null>(null); const [reviewReason, setReviewReason] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false); const [reviewError, setReviewError] = useState(""); const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useCallback((message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 4500); }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => { const controller = new AbortController(); api<{ admin: boolean; backend: string }>("/api/session", { signal: controller.signal }).then(setSession).catch(e => { if (e.name !== "AbortError") setSession({ admin: false, backend: "local" }); }); return () => controller.abort(); }, []);
  useEffect(() => { const timeout = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timeout); }, [search]);
  const url = useCallback((offset = 0) => {
    const values = new URLSearchParams({ scope: view, offset: String(offset) });
    if (kind !== "all" && view === "feed") values.set("kind", kind);
    if (query && view === "feed") values.set("q", query);
    if (view === "admin") values.set("status", adminFilter === "reported" ? "approved" : adminFilter);
    return `/api/posts?${values}`;
  }, [view, kind, query, adminFilter]);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (view === "admin" && !session?.admin) { setLoading(false); return; }
    setLoading(true); setError("");
    try { const result = await api<{ posts: Post[]; hasMore: boolean }>(url(), { signal }); setPosts(result.posts); setHasMore(result.hasMore); }
    catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [view, session?.admin, url]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function more() { setLoadingMore(true); try { const result = await api<{ posts: Post[]; hasMore: boolean }>(url(posts.length)); setPosts(current => [...current, ...result.posts.filter(p => !current.some(old => old.id === p.id))]); setHasMore(result.hasMore); } catch (e) { announce((e as Error).message); } finally { setLoadingMore(false); } }
  function create() { setEditing(null); setSubmissionComplete(false); setComposerOpen(true); }
  async function logIn(e: React.FormEvent) { e.preventDefault(); setLoginBusy(true); setLoginError(""); try { await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); setPassword(""); setSession(current => ({ admin: true, backend: current?.backend ?? "local" })); } catch (e) { setLoginError((e as Error).message); } finally { setLoginBusy(false); } }
  async function logOut() { try { await api("/api/admin/logout", { method: "POST", body: "{}" }); setSession(current => ({ ...current!, admin: false })); setPosts([]); } catch (e) { announce((e as Error).message); } }
  async function moderate(post: Post, action: "approve" | "reject" | "hide", reason = "") {
    setReviewBusy(true); setReviewError("");
    try { await api(`/api/admin/posts/${post.id}`, { method: "POST", body: JSON.stringify({ action, reason, revision: post.revision }) }); setReview(null); announce(action === "approve" ? "Kiriman terbit." : action === "reject" ? "Kiriman dikembalikan." : "Kiriman disembunyikan."); await load(); }
    catch (e) { if (action === "approve") announce((e as Error).message); else setReviewError((e as Error).message); } finally { setReviewBusy(false); }
  }
  function reviewPost(post: Post, action: "approve" | "reject" | "hide") { if (reviewBusy) return; if (action === "approve") void moderate(post, action); else { setReviewReason(""); setReviewError(""); setReview({ post, action }); } }
  const visiblePosts = view === "admin" && adminFilter === "reported" ? posts.filter(p => (p.reports ?? 0) > 0) : posts;
  const title = view === "mine" ? "Kiriman saya" : view === "admin" ? "Review kiriman" : "Beranda";
  return <div className="app-shell"><a className="skip-link" href="#main-content">Ke konten</a>
    <aside className="desktop-sidebar"><Brand /><nav aria-label="Navigasi utama"><Link href="/" className={cn("nav-item", view === "feed" && "active")} aria-current={view === "feed" ? "page" : undefined}><Home size={23} />Beranda</Link><button className="nav-item nav-create" onClick={create}><Plus size={23} />Kirim</button><Link href="/?view=mine" className={cn("nav-item", view === "mine" && "active")} aria-current={view === "mine" ? "page" : undefined}><Inbox size={23} />Kiriman saya</Link></nav><div className="sidebar-bottom"><div className="cohort-mini"><Image src="/assets/p3md-crest.png" width={36} height={36} alt="Lambang P3MD" /><span>P3MD</span></div><Link href="/admin" className={cn("admin-link", view === "admin" && "active")}><LockKeyhole size={15} />Admin</Link></div></aside>
    <header className="mobile-header"><Brand /><Link href="/admin" className="icon-button" aria-label="Admin"><LockKeyhole size={19} /></Link></header>
    <main id="main-content" className="main-column"><header className="feed-heading"><div><h1>{title}</h1>{process.env.NEXT_PUBLIC_UI_PREVIEW === "true" && <p>Demo UI · data sementara</p>}{view === "mine" && <p>Tersimpan di browser ini.</p>}</div>{view === "admin" && session?.admin ? <button className="icon-button" aria-label="Keluar dari admin" onClick={() => void logOut()}><LogOut size={21} /></button> : null}</header>
      {view === "feed" && <><button className="composer-prompt" onClick={create}><span className="anonymous-avatar"><Shield size={18} /></span><span>Ada kebaikan hari ini?</span><span className="prompt-plus"><Plus size={21} /></span></button><div className="feed-tools"><div className="filter-tabs" role="group" aria-label="Filter kiriman"><button className={cn(kind === "all" && "selected")} aria-pressed={kind === "all"} onClick={() => setKind("all")}>Semua</button>{POST_KINDS.map(value => <button key={value} className={cn(kind === value && "selected")} aria-pressed={kind === value} onClick={() => setKind(value)}>{kindLabels[value]}</button>)}</div><div className="search-field"><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kebaikan" aria-label="Cari kebaikan" maxLength={100} /></div></div></>}
      {view === "admin" && !session?.admin ? <div className="admin-login"><span className="login-icon"><LockKeyhole size={27} /></span><h2>Masuk sebagai admin</h2>{process.env.NEXT_PUBLIC_UI_PREVIEW === "true" && <Button className="full-width" variant="secondary" onClick={() => { void api("/api/admin/login", { method: "POST", body: "{}" }).then(() => setSession({ admin: true, backend: "preview" })); }}>Coba admin</Button>}<form onSubmit={logIn}><label className="field">Kata sandi<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{loginError && <p role="alert" className="field-error">{loginError}</p>}<Button className="full-width" type="submit" disabled={loginBusy}>{loginBusy ? "Memeriksa…" : "Masuk"}</Button></form></div> : <>
        {view === "admin" && <div className="admin-filters filter-tabs" role="group" aria-label="Status review">{([["pending", "Menunggu"], ["approved", "Terbit"], ["reported", "Dilaporkan"], ["rejected", "Dikembalikan"], ["hidden", "Tersembunyi"]] as const).map(([value, label]) => <button key={value} className={cn(adminFilter === value && "selected")} onClick={() => setAdminFilter(value)} aria-pressed={adminFilter === value}>{label}</button>)}</div>}
        <div className="post-list" aria-busy={loading}>{loading ? <div className="feed-skeleton" role="status" aria-label="Memuat kiriman"><div className="skeleton-author" /><div className="skeleton-media" /><div className="skeleton-line" /><div className="skeleton-line short" /></div> : error ? <div className="empty-state"><p role="alert">{error}</p><Button variant="secondary" onClick={() => void load()}>Coba lagi</Button></div> : visiblePosts.length ? visiblePosts.map(post => <PostCard key={`${post.id}-${post.revision}`} post={post} scope={view} onMessage={announce} onEdit={post => { setEditing(post); setComposerOpen(true); }} onReview={reviewPost} />) : <div className="empty-state"><span className="empty-icon">{view === "admin" ? <Check size={27} /> : view === "mine" ? <Inbox size={27} /> : <Heart size={27} />}</span><h2>{view === "admin" ? "Semua beres." : view === "mine" ? "Belum ada kiriman." : query ? "Belum ditemukan." : "Belum ada cerita baik."}</h2>{view !== "admin" && <Button variant="secondary" onClick={create}>Bagikan kebaikan</Button>}</div>}</div>
        {!loading && hasMore && <Button className="load-more" variant="secondary" onClick={() => void more()} disabled={loadingMore}>{loadingMore ? "Memuat…" : "Muat lainnya"}</Button>}
      </>}
    </main>
    <aside className="community-aside"><div className="community-mark"><Image src="/assets/p3md-crest.png" width={68} height={68} alt="P3MD" /><div><strong>P3MD</strong><span>Ruang berbagi kebaikan.</span></div></div><div className="space-guidance"><Shield size={17} /><p>Pengirim anonim.<br />Direview sebelum terbit.</p></div></aside>
    <nav className="mobile-nav" aria-label="Navigasi utama"><Link href="/" className={cn(view === "feed" && "active")} aria-current={view === "feed" ? "page" : undefined}><Home size={23} /><span>Beranda</span></Link><button onClick={create}><span className="mobile-create"><Plus size={23} /></span><span>Kirim</span></button><Link href="/?view=mine" className={cn(view === "mine" && "active")} aria-current={view === "mine" ? "page" : undefined}><Inbox size={23} /><span>Kiriman saya</span></Link></nav>
    {composerOpen && <Composer key={editing?.id ?? "new"} open onOpenChange={value => { setComposerOpen(value); if (!value && submissionComplete && view !== "mine") router.push("/?view=mine"); }} editing={editing} backend={session?.backend ?? "local"} onSubmitted={() => { setSubmissionComplete(true); void load(); }} />}
    <Modal open={Boolean(review)} onOpenChange={value => { if (!value && !reviewBusy) setReview(null); }} title={review?.action === "hide" ? "Sembunyikan kiriman" : "Kembalikan kiriman"}><form onSubmit={e => { e.preventDefault(); if (review) void moderate(review.post, review.action, reviewReason); }}><label className="field">Alasan<textarea value={reviewReason} onChange={e => setReviewReason(e.target.value)} rows={3} minLength={3} maxLength={500} required placeholder="Catatan untuk pengirim" /></label>{reviewError && <p role="alert" className="field-error">{reviewError}</p>}<Button className="full-width" variant={review?.action === "hide" ? "danger" : "primary"} disabled={reviewBusy} type="submit">{reviewBusy ? "Menyimpan…" : "Simpan"}</Button></form></Modal>
    <div className={cn("toast", toast && "visible")} role="status" aria-live="polite">{toast && <><span>{toast}</span><button className="icon-button" aria-label="Tutup pemberitahuan" onClick={() => setToast("")}><X size={17} /></button></>}</div>
  </div>;
}
