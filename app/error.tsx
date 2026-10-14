"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="flex min-h-screen items-center justify-center bg-canvas p-6"><div className="max-w-md rounded-2xl border border-line bg-white p-8"><h1 className="font-display text-4xl text-forest">Let’s try that again.</h1><p className="my-5 text-sm leading-7 text-muted">We couldn’t open your workspace. Please retry. If this continues, contact your organizer.</p><ActionButton onPress={reset}>Try again</ActionButton></div></main>;
}
