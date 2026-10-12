import { Suspense } from "react";
import { ArticleReader } from "@/components/article-reader";

export default function ArticlePage() {
  return <Suspense fallback={<main className="page-error">Memuat artikel…</main>}><ArticleReader /></Suspense>;
}
