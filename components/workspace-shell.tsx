"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, ChevronRight, Compass, DoorOpen, House, LayoutDashboard, LogOut, MapPin, Menu, PanelLeftClose, PanelLeftOpen, UsersRound, X, type LucideIcon } from "lucide-react";
import { Button, Modal, Tooltip } from "@heroui/react";
import { BrandMark, BrandWordmark } from "./brand";
import { authClient } from "@/lib/auth-client";
import { useWorkspace } from "./workspace-context";

const navigation = [
  { href: "/", label: "Home", icon: House },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/sprint", label: "14-day Sprint", icon: CalendarDays },
  { href: "/open-doors", label: "Open Doors", icon: DoorOpen },
  { href: "/community", label: "Community", icon: UsersRound },
];

const sidebarPreferenceKey = "philoxenia.sidebar-collapsed";
const sidebarPreferenceEvent = "philoxenia-sidebar-change";
const workspaceScrollbar = "scrollbar-thin [--scrollbar-thumb:var(--foreground)] [--scrollbar-track:transparent]";
let sidebarFallback = false;
let sidebarStorageAvailable = true;

function getSidebarCollapsed() {
  if (!sidebarStorageAvailable) return sidebarFallback;
  try { return window.localStorage.getItem(sidebarPreferenceKey) === "true"; }
  catch { return sidebarFallback; }
}

function subscribeSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(sidebarPreferenceEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(sidebarPreferenceEvent, callback);
  };
}

function toggleSidebar() {
  sidebarFallback = !getSidebarCollapsed();
  try { window.localStorage.setItem(sidebarPreferenceKey, String(sidebarFallback)); }
  catch { sidebarStorageAvailable = false; }
  window.dispatchEvent(new Event(sidebarPreferenceEvent));
}

function SidebarLink({ href, label, icon: Icon, active, compact, onNavigate }: { href: string; label: string; icon: LucideIcon; active: boolean; compact: boolean; onNavigate: () => void }) {
  const className = `flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm transition-colors duration-150 ${active ? "bg-sage font-medium text-forest" : "text-muted hover:bg-white hover:text-foreground"}`;
  return <Tooltip delay={0} closeDelay={0} isDisabled={!compact} shouldSkipAnimation><Tooltip.Trigger<"a"> role="link" aria-label={label} aria-current={active ? "page" : undefined} className={className} onClick={onNavigate} render={(props) => <Link {...props} href={href} />}><Icon className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden /><span aria-hidden={compact} className={`whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none ${compact ? "opacity-0" : "opacity-100"}`}>{label}</span></Tooltip.Trigger><Tooltip.Content placement="right" offset={12} className="rounded-lg border border-line bg-white px-3 py-2 text-xs text-foreground shadow-control">{label}</Tooltip.Content></Tooltip>;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { preview, viewer } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarCollapsed, () => false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = pathname === "/preview" ? "/" : pathname;
  const current = [...navigation, { href: "/organizer", label: "Command Center" }].find((item) => item.href === active)?.label ?? "Workspace";

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

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

  const sidebar = (compact: boolean) => <>
    <Link href="/" aria-label="Philoxenia home" className="relative mb-8 flex min-h-10 items-center overflow-hidden px-2" onClick={() => setMobileOpen(false)}><BrandWordmark className={`h-auto w-44 shrink-0 transition-opacity duration-150 motion-reduce:transition-none ${compact ? "opacity-0" : "opacity-100"}`} /><BrandMark className={`absolute inset-y-0 start-1 my-auto h-auto w-10 transition-opacity duration-150 motion-reduce:transition-none ${compact ? "opacity-100" : "opacity-0"}`} /></Link>
    <nav aria-label="Main navigation" className="space-y-1">{navigation.map((item) => <SidebarLink key={item.href} {...item} active={active === item.href} compact={compact} onNavigate={() => setMobileOpen(false)} />)}</nav>
    {preview || viewer?.isOrganizer ? <div className="mt-6 border-t border-line pt-5"><SidebarLink href="/organizer" label="Command Center" icon={LayoutDashboard} active={active === "/organizer"} compact={compact} onNavigate={() => setMobileOpen(false)} /></div> : null}
    <div className="mt-auto pt-8">
      <div aria-hidden={compact} className={`grid transition-[grid-template-rows,opacity,margin-bottom] duration-200 ease-ui motion-reduce:transition-none ${compact ? "mb-0 grid-rows-[0fr] opacity-0" : "mb-5 grid-rows-[1fr] opacity-100"}`}><div className="min-h-0 overflow-hidden"><div className="rounded-2xl bg-white/80 p-4 whitespace-nowrap"><MapPin className="mb-3 size-[18px] text-forest" strokeWidth={1.7} aria-hidden /><p className="text-sm font-medium text-foreground">San Francisco</p><p className="mt-1 text-xs leading-5 text-muted">Two weeks of possibility.</p></div></div></div>
      <div className={`flex gap-3 px-1 py-2 ${compact ? "flex-col items-start" : "items-center"}`}><span aria-label={viewer?.name ?? "Workspace preview"} role="img" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-sm font-medium text-forest">{viewer?.name?.charAt(0).toUpperCase() ?? "P"}</span>{!compact ? <div className="min-w-0 flex-1"><p className="text-sm font-medium wrap-anywhere text-foreground">{viewer?.name ?? "Workspace preview"}</p><p className="mt-0.5 text-xs text-muted">{preview ? "Local preview" : viewer?.isOrganizer ? "Organizer" : "Hustler"}</p></div> : null}{!preview ? <Tooltip delay={0} isDisabled={!compact}><Button isIconOnly variant="ghost" aria-label="Sign out" isDisabled={signingOut} onPress={signOut} className="size-9 min-w-0 text-muted"><LogOut className="size-4" /></Button><Tooltip.Content placement="right" offset={12}>Sign out</Tooltip.Content></Tooltip> : null}</div>
      {signOutError ? <p role="alert" className="mt-2 text-xs text-red-800">{signOutError}</p> : null}
    </div>
  </>;

  return <div className="flex h-dvh overflow-hidden bg-soft">
    <aside id="desktop-sidebar" aria-label="Workspace sidebar" data-state={collapsed ? "collapsed" : "expanded"} className={`z-30 hidden h-full shrink-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-5 transition-[width] duration-200 ease-ui motion-reduce:transition-none lg:flex ${workspaceScrollbar} ${collapsed ? "w-18" : "w-60"}`}>{sidebar(collapsed)}</aside>
    <Modal isOpen={mobileOpen} onOpenChange={setMobileOpen}><Modal.Backdrop className="lg:hidden"><Modal.Container placement="top" className="fixed inset-y-0 start-0 m-0 h-dvh w-72 max-w-[calc(100vw-24px)] p-0"><Modal.Dialog id="workspace-navigation" aria-label="Workspace navigation" className={`flex h-dvh flex-col overflow-y-auto rounded-none bg-soft px-4 py-7 ${workspaceScrollbar}`}><Modal.CloseTrigger aria-label="Close navigation" className="absolute end-3 top-3"><X className="size-4" aria-hidden /></Modal.CloseTrigger>{sidebar(false)}</Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
    <div ref={panelRef} role="region" aria-label="Workspace content" className={`min-h-0 min-w-0 flex-1 scroll-pt-16 overflow-y-auto overscroll-y-contain bg-white [scrollbar-gutter:stable] lg:my-2 lg:me-2 lg:rounded-[20px] ${workspaceScrollbar}`}>
      <a href="#main-content" className="sr-only z-60 rounded-xl bg-white p-3 focus:not-sr-only focus:fixed focus:start-2 focus:top-2">Skip to content</a>
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-line/70 bg-white px-5 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Tooltip delay={0} shouldSkipAnimation><Button isIconOnly variant="ghost" className="hidden size-9 min-w-0 shrink-0 text-muted lg:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-sidebar" onPress={toggleSidebar}>{collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}</Button><Tooltip.Content placement="bottom">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</Tooltip.Content></Tooltip><Button isIconOnly variant="ghost" className="shrink-0 lg:hidden" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={mobileOpen} aria-controls={mobileOpen ? "workspace-navigation" : undefined} onPress={() => setMobileOpen(true)}><Menu className="size-5" /></Button><span className="hidden text-sm text-muted sm:inline">Workspace</span><ChevronRight className="hidden size-3.5 text-muted/60 sm:block" aria-hidden /><span className="text-sm text-foreground">{current}</span></div><a href="https://philoxenia.hustlehours.com/" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">About Philoxenia<ArrowUpRight className="size-3.5" aria-hidden /></a></header>
      {preview ? <div className="mx-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-2.5 text-xs leading-5 text-muted sm:mx-6"><span>Workspace preview · Sample cohort. Changes are disabled.</span><Link href="/sign-in" className="inline-flex items-center gap-1.5 rounded-sm font-medium text-forest underline-offset-4 hover:underline">Sign in to your account<ArrowUpRight className="size-3.5" aria-hidden /></Link></div> : null}
      <main id="main-content" tabIndex={-1} className="px-5 py-8 sm:px-6 lg:mx-3 lg:mt-4"><div className="mx-auto w-full max-w-[1200px]">{children}</div></main>
      <footer className="mx-auto max-w-[1280px] px-5 py-6 text-xs text-muted sm:px-6">Philoxenia OS <span className="mx-1 text-muted/50">·</span> By Hustle Hours</footer>
    </div>
  </div>;
}
