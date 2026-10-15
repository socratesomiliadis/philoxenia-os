"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6"><div className="max-w-md rounded-[20px] border border-line bg-white p-8 shadow-panel"><h1 className="text-3xl font-medium tracking-tight text-foreground">Unable to open your workspace.</h1><p className="my-5 text-sm leading-7 text-muted">Try again. If this continues, contact your organizer.</p><ActionButton onClick={reset}>Try again</ActionButton></div></main>;
}
