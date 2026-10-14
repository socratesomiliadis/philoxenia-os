import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-canvas p-6"><div><p className="text-xs tracking-widest text-muted uppercase">404 · A little detour</p><h1 className="my-5 font-display text-5xl text-forest">This door isn’t here.</h1><Link href="/" className="flex items-center gap-2 text-sm text-forest"><ArrowLeft className="size-4" aria-hidden />Back to your workspace</Link></div></main>;
}
