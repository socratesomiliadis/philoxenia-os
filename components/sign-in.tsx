"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, ArrowUpRight, ShieldCheck, CalendarDays, DoorOpen, Compass } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { backendConfigured } from "./providers";
import { BrandMark, SanFranciscoIllustration } from "./brand";
import { ActionButton, InlineError } from "./ui";

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
      Promise.resolve().then(() => setError("Google sign-in was not completed. Please try again."));
    }
  }, []);

  async function signIn() {
    setBusy(true); setError(null);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/sign-in?error=google" });
      if (result.error) throw new Error(result.error.message);
    } catch { setError("We couldn't connect to Google. Please try again."); setBusy(false); }
  }

  return <main className="grid min-h-screen bg-canvas lg:grid-cols-2">
    <section className="relative flex flex-col justify-between overflow-hidden bg-forest p-8 text-white sm:p-14 lg:p-16">
      <Link href="https://philoxenia.hustlehours.com/" className="flex items-center gap-3"><BrandMark className="size-11 text-gold" /><div><p className="text-xl font-semibold">philoxenia<span className="ml-1 font-normal text-gold">os</span></p><p className="mt-1 text-[9px] tracking-[0.2em] text-white/50 uppercase">By Hustle Hours</p></div></Link>
      <div className="relative z-10 my-12 max-w-lg"><p className="mb-6 text-xs tracking-[0.2em] text-gold uppercase">The door is open.</p><h1 className="font-display text-5xl leading-[1.08] tracking-tight sm:text-6xl xl:text-7xl">Big ambitions.<br />A place to begin.</h1><p className="mt-6 max-w-sm text-sm leading-7 text-white/60">Two weeks in San Francisco. A community in your corner. Make room for what happens next.</p></div>
      <SanFranciscoIllustration className="w-full max-w-lg" />
      <p className="mt-8 text-[10px] text-white/40">Open your home. Your network. Your time.</p>
    </section>
    <section className="flex flex-col justify-center px-7 py-14 sm:px-14 lg:px-20 xl:px-28">
      <div className="mx-auto w-full max-w-md"><p className="mb-4 text-[10px] font-medium tracking-[0.18em] text-muted uppercase">Your Philoxenia workspace</p><h2 className="font-display text-4xl text-forest sm:text-5xl">Welcome, Hustler.</h2><p className="mt-4 mb-9 text-sm leading-7 text-muted">Your next chapter starts with a hello. Sign in with the Google account your organizer invited.</p>
        <ActionButton onPress={signIn} busy={busy} isDisabled={!ready} className="w-full border border-line bg-white text-forest"><GoogleIcon />{checking ? "Checking sign-in…" : ready ? "Continue with Google" : "Google sign-in is not connected yet"}</ActionButton>
        <div className="mt-4"><InlineError message={error} /></div>
        <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted"><ShieldCheck className="size-3.5" aria-hidden />Invite-only. Just your community.</p>
        {!ready && !checking ? <p className="mt-7 rounded-xl border border-line bg-white p-4 text-xs leading-6 text-muted">Your workspace is being connected. An organizer will let you know when sign-in is ready.</p> : null}
        <div className="my-10 h-px bg-line" />
        <div className="space-y-5">{[{ icon: Compass, title: "Find your kind of opportunity", detail: "The right events, people, and places." }, { icon: CalendarDays, title: "Give your 14 days direction", detail: "A personal mission and a Sprint to match." }, { icon: DoorOpen, title: "Let the community open doors", detail: "Support from people who were once in your shoes." }].map(({ icon: Icon, title, detail }) => <div key={title} className="flex gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/5"><Icon className="size-4 text-forest" aria-hidden /></span><div><p className="text-xs font-medium text-forest">{title}</p><p className="mt-1 text-[11px] text-muted">{detail}</p></div></div>)}</div>
        {process.env.NODE_ENV === "development" ? <Link href="/preview" className="mt-10 inline-flex items-center gap-2 text-xs text-muted hover:text-forest"><ArrowLeft className="size-3.5" aria-hidden />Explore the local preview</Link> : null}
        <a href="https://philoxenia.hustlehours.com/" target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center gap-1 text-[11px] text-muted">Not part of Philoxenia yet? Meet the program<ArrowUpRight className="size-3" aria-hidden /></a>
      </div>
    </section>
  </main>;
}
