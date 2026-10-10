"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="page-error"><h1>Halaman belum bisa dimuat.</h1><Button onClick={reset}>Coba lagi</Button></main>; }
