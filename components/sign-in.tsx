"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, ArrowUpRight, ShieldCheck, CalendarDays, DoorOpen, Compass } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { backendConfigured } from "./providers";
import { BrandMark, SanFranciscoIllustration } from "./brand";
import { ActionButton, IconTile, InlineError } from "./ui";

export function SignInScreen() {
  return backendConfigured ? <ConnectedSignIn /> : <SignInContent ready={false} />;
}

function ConnectedSignIn() {
  const readiness = useQuery(api.auth.readiness);
  return <SignInContent ready={readiness?.google ?? false} checking={readiness === undefined} />;
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.31 2.99-7.35Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.05.97-3.38.97-2.6 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.31.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.51l3.34-2.59Z" /><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.71 9.4 5.95 12 5.95Z" /></svg>;
}

function SignInContent({ ready, checking = false }: { ready: boolean; checking?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      // Do not reflect arbitrary provider errors or query strings into the UI.
      Promise.resolve().then(() => setError("Google sign-in was not completed. Try again."));
    }
  }, []);

  async function signIn() {
    setBusy(true); setError(null);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/sign-in?error=google" });
      if (result.error) throw new Error(result.error.message);
    } catch { setError("Unable to connect to Google. Check your connection and try again."); setBusy(false); }
  }

  return <main className="grid min-h-dvh bg-white lg:grid-cols-2">
    <section className="relative flex min-w-0 flex-col justify-between bg-canvas p-7 sm:p-12 lg:p-14 xl:p-20">
      <Link href="https://philoxenia.hustlehours.com/" className="flex w-fit items-center gap-2.5"><BrandMark className="size-9 text-forest" /><span className="text-xl font-semibold tracking-tight text-foreground">philoxenia<span className="ms-1 font-normal text-muted">os</span></span></Link>
      <div className="my-12 max-w-lg lg:my-16"><h1 className="text-4xl leading-[1.12] font-medium tracking-[-0.045em] text-foreground sm:text-5xl xl:text-6xl">Big ambitions.<br /><span className="text-forest">A place to begin.</span></h1><p className="mt-6 max-w-sm text-sm leading-7 text-muted">Two weeks in San Francisco. A community in your corner. Make room for what comes next.</p></div>
      <SanFranciscoIllustration className="hidden w-full max-w-lg rounded-[24px] bg-warm lg:block" />
      <p className="mt-8 hidden text-xs text-muted lg:block">Philoxenia by Hustle Hours</p>
    </section>
    <section className="flex min-w-0 flex-col justify-center px-7 py-12 sm:px-14 lg:px-16 xl:px-24">
      <div className="mx-auto w-full max-w-sm"><h2 className="text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">Welcome, Hustler.</h2><p className="mt-3 mb-7 text-sm leading-7 text-muted">Sign in with the Google account your organizer invited.</p>
        <ActionButton onPress={signIn} busy={busy} isDisabled={!ready} appearance="secondary" className="w-full px-3 text-sm"><GoogleIcon />{checking ? "Checking sign-in…" : ready ? "Continue with Google" : "Google sign-in is not connected yet"}</ActionButton>
        <div className="mt-4"><InlineError message={error} /></div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted"><ShieldCheck className="size-4" aria-hidden />Invite-only. Just your community.</p>
        {!ready && !checking ? <p className="mt-6 rounded-xl bg-soft/70 p-4 text-sm leading-6 text-muted">Your workspace is being connected. Your organizer will let you know when sign-in is ready.</p> : null}
        <div className="mt-9 space-y-5">{[{ icon: Compass, title: "Find your opportunities", detail: "The right events, people, and places." }, { icon: CalendarDays, title: "Plan your two weeks", detail: "A personal mission and a Sprint to match." }, { icon: DoorOpen, title: "Open a door", detail: "Advice and introductions from alumni." }].map(({ icon, title, detail }) => <div key={title} className="flex gap-3"><IconTile icon={icon} /><div><p className="text-sm font-medium text-foreground">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div></div>)}</div>
        <div className="mt-9 flex flex-col items-start gap-5">{process.env.NODE_ENV === "development" ? <Link href="/preview" className="inline-flex items-center gap-2 rounded-sm text-sm text-muted underline-offset-4 hover:text-forest hover:underline"><ArrowLeft className="size-4" aria-hidden />Explore the local preview</Link> : null}
        <a href="https://philoxenia.hustlehours.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-sm text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">Meet the Philoxenia program<ArrowUpRight className="size-3.5" aria-hidden /></a></div>
      </div>
    </section>
  </main>;
}
