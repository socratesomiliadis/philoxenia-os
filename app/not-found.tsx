import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6"><div className="max-w-md rounded-[20px] border border-line bg-white p-8 shadow-panel"><h1 className="text-3xl font-medium tracking-tight text-foreground">Page not found.</h1><p className="mt-3 text-sm leading-6 text-muted">Check the address or return to your workspace.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-sage"><ArrowLeft className="size-4" aria-hidden />Back to your workspace</Link></div></main>;
}
