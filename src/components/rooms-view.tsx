"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Plus, Search, Users } from "lucide-react";
import { feedKinds, feedKindLabels, type Room, type FeedPost, type FeedKind } from "@/lib/preview-types";
import { api, cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { PostCard } from "./post-card";
import { usePreviewChange } from "./use-preview-change";

function RoomForm({ room, onDone }: { room: Room | null; onDone: () => void }) {
  const [name, setName] = useState(room?.name ?? ""); const [description, setDescription] = useState(room?.description ?? "");
  const [rules, setRules] = useState(room?.rules ?? "Bahas kegiatan positif. Hormati orang lain dan jaga privasi.");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api(room ? `/api/admin/rooms/${room.id}` : "/api/admin/rooms", { method: room ? "PUT" : "POST", body: JSON.stringify({ name, description, rules }) }); onDone(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form className="room-form" onSubmit={submit}><h2>{room ? "Edit Ruang" : "Buat Ruang"}</h2>
    <label className="field">Nama Ruang<input aria-label="Nama Ruang" value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={60} /></label>
    <label className="field">Deskripsi Ruang<textarea aria-label="Deskripsi Ruang" value={description} onChange={e => setDescription(e.target.value)} required minLength={3} maxLength={280} rows={2} /></label>
    <label className="field">Aturan Ruang<textarea aria-label="Aturan Ruang" value={rules} onChange={e => setRules(e.target.value)} required minLength={3} maxLength={1000} rows={3} /></label>
    {error && <p role="alert" className="field-error">{error}</p>}
    <div className="room-form-actions">{room && <Button type="button" variant="secondary" disabled={busy} onClick={onDone}>Batal</Button>}<Button type="submit" disabled={busy}>{busy ? "Menyimpan…" : room ? "Simpan Ruang" : "Buat Ruang"}</Button></div>
  </form>;
}
export function RoomsView({ slug, admin = false, onCreate, onMessage }: { slug?: string | null; admin?: boolean; onCreate: (roomId: string) => void; onMessage: (message: string) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]); const [posts, setPosts] = useState<FeedPost[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [search, setSearch] = useState(""); const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FeedKind | "all">("all"); const [editing, setEditing] = useState<Room | null>(null);
  const [formVersion, setFormVersion] = useState(0); const [busyId, setBusyId] = useState(""); const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  useEffect(() => { const timeout = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timeout); }, [search]);
  const postUrl = useCallback((roomId: string, offset = 0) => {
    const params = new URLSearchParams({ scope: "feed", roomId, offset: String(offset) });
    if (kind !== "all") params.set("kind", kind); if (query) params.set("q", query);
    return `/api/posts?${params}`;
  }, [kind, query]);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api<{ rooms: Room[] }>("/api/rooms", { signal }); setRooms(result.rooms); setError("");
      if (slug) {
        const room = result.rooms.find(value => value.slug === slug); if (!room) throw new Error("Ruang tidak ditemukan.");
        const feed = await api<{ posts: FeedPost[]; hasMore: boolean }>(postUrl(room.id), { signal }); setPosts(feed.posts); setHasMore(feed.hasMore);
      }
    } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [slug, postUrl]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); void load(controller.signal); return () => controller.abort(); }, [load]);
  usePreviewChange(useCallback(() => { void load(); }, [load]));
  const selected = rooms.find(room => room.slug === slug);
  async function follow(room: Room) { setBusyId(room.id); try { await api(`/api/rooms/${room.id}/follow`, { method: "POST", body: "{}" }); } catch (e) { onMessage((e as Error).message); } finally { setBusyId(""); } }
  async function more() {
    if (!selected) return; setMoreBusy(true);
    try { const result = await api<{ posts: FeedPost[]; hasMore: boolean }>(postUrl(selected.id, posts.length)); setPosts(current => [...current, ...result.posts]); setHasMore(result.hasMore); }
    catch (e) { onMessage((e as Error).message); } finally { setMoreBusy(false); }
  }
  function done() { setEditing(null); setFormVersion(value => value + 1); void load(); }
  if (loading) return <p className="section-feedback" role="status">Memuat Ruang…</p>;
  if (error) return <div className="section-feedback"><p role="alert">{error}</p><Link href="/ruang">Semua Ruang</Link><Button variant="secondary" onClick={() => void load()}>Coba lagi</Button></div>;
  return <div className="rooms-view">
    {admin && <RoomForm key={editing?.id ?? formVersion} room={editing} onDone={done} />}
    {selected ? <>
      <Link href="/ruang" className="context-back">Semua Ruang</Link>
      <section className="room-heading"><span className="room-symbol"><Users size={24} aria-hidden="true" /></span><h2>{selected.name}</h2><p>{selected.description}</p>
        <details><summary>Aturan Ruang</summary><p>{selected.rules}</p></details>
        <div className="room-card-actions"><Button variant="secondary" disabled={busyId === selected.id} onClick={() => void follow(selected)}>{selected.following ? <Check size={18} /> : <Plus size={18} />}{selected.following ? "Diikuti" : "Ikuti Ruang"}</Button><Button onClick={() => onCreate(selected.id)}>Kirim ke Ruang</Button></div>
      </section>
      <div className="feed-tools"><div className="filter-tabs" role="group" aria-label="Filter kiriman Ruang"><button onClick={() => setKind("all")} aria-pressed={kind === "all"} className={cn(kind === "all" && "selected")}>Semua</button>{feedKinds.map(value => <button key={value} onClick={() => setKind(value)} aria-pressed={kind === value} className={cn(kind === value && "selected")}>{feedKindLabels[value]}</button>)}</div><div className="search-field"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Cari di Ruang" placeholder="Cari di Ruang" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} /></div></div>
      <div className="post-list">{posts.length ? posts.map(post => <PostCard key={`${post.id}-${post.revision}`} post={post} back={`/ruang?slug=${encodeURIComponent(selected.slug)}`} onMessage={onMessage} />) : <p className="section-feedback">{query ? "Belum ditemukan." : "Belum ada kiriman di Ruang ini."}</p>}</div>
      {hasMore && <Button className="load-more" variant="secondary" disabled={moreBusy} onClick={() => void more()}>{moreBusy ? "Memuat…" : "Muat lainnya"}</Button>}
    </> : <div className="room-grid">{rooms.map(room => <section className="room-card" key={room.id}>
      <Link href={`/ruang?slug=${encodeURIComponent(room.slug)}`}><span className="room-symbol"><Users size={21} aria-hidden="true" /></span><h2>{room.name}</h2><p>{room.description}</p></Link>
      <span className="room-count">{room.postCount} kiriman</span>
      <div className="room-card-actions"><Button variant="secondary" disabled={busyId === room.id} onClick={() => void follow(room)} aria-label={`${room.following ? "Berhenti mengikuti" : "Ikuti"} ${room.name}`}>{room.following ? <Check size={18} /> : <Plus size={18} />}{room.following ? "Diikuti" : "Ikuti"}</Button>{admin && <Button variant="ghost" onClick={() => setEditing(room)} aria-label={`Edit ${room.name}`}>Edit</Button>}</div>
    </section>)}</div>}
  </div>;
}
