import { CommunityApp } from "@/components/community-app";
import { Suspense } from "react";
import Link from "next/link";
export default function Rooms() {
  if (process.env.NEXT_PUBLIC_UI_PREVIEW !== "true") return <main className="page-error"><p>Ruang tersedia di demo UI.</p><Link href="/">Kembali ke beranda</Link></main>;
  return <Suspense fallback={<main className="page-error">Memuat…</main>}><CommunityApp initialView="rooms" /></Suspense>;
}
