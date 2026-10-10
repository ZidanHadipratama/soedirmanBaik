import { CommunityApp } from "@/components/community-app";
import { Suspense } from "react";
export default function Admin() { return <Suspense fallback={<main className="page-error">Memuat…</main>}><CommunityApp initialView="admin" /></Suspense>; }
