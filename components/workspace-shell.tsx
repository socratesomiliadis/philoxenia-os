"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Compass, DoorOpen, House, LayoutDashboard, LogOut, MapPin, Menu, UsersRound, X, PanelLeftClose } from "lucide-react";
import { Button } from "@heroui/react";
import { BrandMark } from "./brand";
import { authClient } from "@/lib/auth-client";
import { useWorkspace } from "./workspace-context";

const navigation = [
  { href: "/", label: "Home", icon: House },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/sprint", label: "14-day Sprint", icon: CalendarDays },
  { href: "/open-doors", label: "Open Doors", icon: DoorOpen },
  { href: "/community", label: "Community", icon: UsersRound },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { preview, viewer } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const active = pathname === "/preview" ? "/" : pathname;
  const current = [...navigation, { href: "/organizer", label: "Command Center" }].find((item) => item.href === active)?.label ?? "Your workspace";
  const name = viewer?.name ?? "Your workspace";

  async function signOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      router.replace("/sign-in");
      router.refresh();
    } catch { setSignOutError("Could not sign out. Try again."); setSigningOut(false); }
  }

  return <div className="min-h-screen bg-canvas">
    {mobileOpen ? <button className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> : null}
    <aside id="workspace-navigation" className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-forest px-5 py-7 text-white transition-transform lg:visible lg:translate-x-0 ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}>
      <Link href="/" className="mb-11 flex items-center gap-3 px-2" onClick={() => setMobileOpen(false)}>
        <BrandMark className="size-10 text-gold" /><div><span className="block text-lg font-semibold tracking-tight">philoxenia<span className="ml-1 font-normal text-gold">os</span></span><span className="text-[9px] tracking-[0.2em] text-white/45 uppercase">By Hustle Hours</span></div>
      </Link>
      <p className="mb-3 px-3 text-[9px] tracking-[0.2em] text-white/35 uppercase">Your chapter</p>
      <nav aria-label="Main navigation" className="space-y-1.5">
        {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] transition-colors ${active === href ? "bg-white/10 font-medium text-gold" : "text-white/65 hover:bg-white/5 hover:text-white"}`}><Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />{label}{active === href ? <span className="ml-auto size-1.5 rounded-full bg-gold" /> : null}</Link>)}
      </nav>
      {preview || viewer?.isOrganizer ? <div className="mt-8 border-t border-white/10 pt-6"><p className="mb-3 px-3 text-[9px] tracking-[0.2em] text-white/35 uppercase">For organizers</p><Link href="/organizer" onClick={() => setMobileOpen(false)} aria-current={active === "/organizer" ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] ${active === "/organizer" ? "bg-white/10 text-gold" : "text-white/65 hover:bg-white/5"}`}><LayoutDashboard className="size-[18px]" strokeWidth={1.6} aria-hidden />Command Center</Link></div> : null}
      <div className="mt-auto pt-8"><div className="relative mb-6 overflow-hidden rounded-xl border border-white/10 p-4"><div className="absolute -right-7 -bottom-7 size-24 rounded-full border border-gold/25" /><MapPin className="mb-4 size-4 text-gold" aria-hidden /><p className="mb-1 text-[10px] tracking-[0.15em] text-white/40 uppercase">Next stop</p><p className="font-display text-2xl text-white">San Francisco.</p><p className="mt-2 text-xs text-white/50">14 days. Make them count.</p></div>
        <div className="flex items-center gap-3 px-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm text-gold">{viewer?.name?.charAt(0).toUpperCase() ?? "P"}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{name}</p><p className="mt-1 text-[10px] text-white/40">{preview ? "Local preview" : viewer?.isOrganizer ? "Organizer" : "Hustler"}</p></div>
          {!preview ? <Button isIconOnly variant="ghost" aria-label="Sign out" isDisabled={signingOut} onPress={signOut} className="size-8 min-w-0 text-white/60"><LogOut className="size-4" /></Button> : null}</div>
        {signOutError ? <p role="alert" className="mt-2 text-xs text-red-200">{signOutError}</p> : null}
      </div>
      <Button isIconOnly variant="ghost" className="absolute top-7 right-3 text-white lg:hidden" aria-label="Close navigation" onPress={() => setMobileOpen(false)}><X className="size-4" /></Button>
    </aside>
    <div className="lg:ml-64">
      <a href="#main-content" className="sr-only z-60 bg-white p-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to content</a>
      <header className="flex h-[76px] items-center justify-between gap-4 border-b border-line bg-white/75 px-5 sm:px-9 lg:px-11"><div className="flex items-center gap-3"><Button isIconOnly variant="ghost" className="lg:hidden" aria-label="Open navigation" onPress={() => setMobileOpen(true)}><Menu className="size-5" /></Button><PanelLeftClose className="hidden size-4 text-muted/50 lg:block" aria-hidden /><span className="hidden text-xs text-muted/50 sm:inline">Workspace</span><span className="hidden text-xs text-muted/35 sm:inline">/</span><span className="text-xs font-medium text-forest">{current}</span></div><div className="flex items-center gap-4"><span className="hidden items-center gap-2 text-[11px] text-muted sm:inline-flex"><span className="size-1.5 rounded-full bg-gold" />San Francisco · Pacific Time</span><a href="https://philoxenia.hustlehours.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-medium text-forest">About Philoxenia<ArrowUpRight className="size-3.5" aria-hidden /></a></div></header>
      {preview ? <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 bg-gold/8 px-5 py-2.5 text-[11px] text-[#76581b] sm:px-9 lg:px-11"><span>Workspace preview · Sample cohort. Changes are disabled.</span><Link href="/sign-in" className="inline-flex items-center gap-1 font-semibold hover:underline">Sign in to your account<ArrowUpRight className="size-3" aria-hidden /></Link></div> : null}
      <main id="main-content" className="mx-auto max-w-[1500px] px-5 py-8 sm:px-9 sm:py-10 lg:px-11">{children}</main>
      <footer className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2 px-5 py-6 text-[10px] text-muted/60 sm:px-9 lg:px-11"><span>Philoxenia OS · Built for the builders.</span><span>Open a door. Start a chapter.</span></footer>
    </div>
  </div>;
}
