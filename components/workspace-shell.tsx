"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CalendarDays, ChevronRight, Compass, DoorOpen, House, LayoutDashboard, MapPin, Menu, PanelLeftClose, PanelLeftOpen, UsersRound, X, type LucideIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "./ui/sheet";
import { BrandMark, BrandWordmark } from "./brand";
import { useWorkspace } from "./workspace-context";
import { useModalNotifications } from "./notification-context";
import { WorkspaceInbox } from "./workspace-inbox";
import { HelpCheckin } from "./help-checkin";
import { WorkspaceAccountMenu } from "./workspace-account-menu";

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
  const className = `flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm transition-colors duration-150 ${active ? "bg-sage font-medium text-forest" : "text-muted-foreground hover:bg-white hover:text-foreground"}`;
  return <Tooltip disabled={!compact}><TooltipTrigger role="link" aria-label={label} aria-current={active ? "page" : undefined} className={className} onClick={onNavigate} render={<Link href={href} />}><Icon className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden /><span aria-hidden={compact} className={`whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none ${compact ? "opacity-0" : "opacity-100"}`}>{label}</span></TooltipTrigger><TooltipContent side="right" sideOffset={12} className="rounded-lg surface-overlay px-3 py-2 text-xs text-foreground shadow-control">{label}</TooltipContent></Tooltip>;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { preview, viewer } = useWorkspace();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useModalNotifications(mobileOpen);
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarCollapsed, () => false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const active = pathname.startsWith("/preview") ? pathname.slice("/preview".length) || "/" : pathname;
  const current = [...navigation, { href: "/organizer", label: "Command Center" }, { href: "/onboarding", label: "Personal mission" }].find((item) => item.href === active)?.label ?? "Workspace";

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const sidebar = (compact: boolean) => <>
    <Link href={preview ? "/preview" : "/"} aria-label="Philoxenia home" className="relative mb-8 flex min-h-10 items-center overflow-hidden px-2" onClick={() => setMobileOpen(false)}><BrandWordmark className={`h-auto w-44 shrink-0 transition-opacity duration-150 motion-reduce:transition-none ${compact ? "opacity-0" : "opacity-100"}`} /><BrandMark className={`absolute inset-y-0 start-1 my-auto h-auto w-10 transition-opacity duration-150 motion-reduce:transition-none ${compact ? "opacity-100" : "opacity-0"}`} /></Link>
    <nav aria-label="Main navigation" className="space-y-1">{navigation.map((item) => <SidebarLink key={item.href} {...item} href={preview ? `/preview${item.href === "/" ? "" : item.href}` : item.href} active={active === item.href} compact={compact} onNavigate={() => setMobileOpen(false)} />)}</nav>
    {preview || viewer?.isOrganizer ? <div className="mt-6 pt-5"><SidebarLink href={preview ? "/preview/organizer" : "/organizer"} label="Command Center" icon={LayoutDashboard} active={active === "/organizer"} compact={compact} onNavigate={() => setMobileOpen(false)} /></div> : null}
    <div className="mt-auto shrink-0 pt-8">
      <div aria-hidden={compact} className={`mb-3 min-w-[216px] rounded-2xl bg-sage/65 p-4 whitespace-nowrap transition-opacity duration-100 ease-ui motion-reduce:transition-none ${compact ? "opacity-0" : "opacity-100"}`}><div className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-gold-foreground" strokeWidth={1.7} aria-hidden /><p className="text-sm font-medium text-foreground">San Francisco</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Two weeks of possibility.</p></div>
      <WorkspaceAccountMenu compact={compact} collapsed={collapsed} onToggleSidebar={toggleSidebar} />
    </div>
  </>;

  return <div className="flex h-dvh overflow-hidden bg-soft">
    <aside id="desktop-sidebar" aria-label="Workspace sidebar" data-state={collapsed ? "collapsed" : "expanded"} className={`z-30 hidden h-full shrink-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-5 transition-[width] duration-200 ease-ui motion-reduce:transition-none lg:flex ${workspaceScrollbar} ${collapsed ? "w-18" : "w-60"}`}>{sidebar(collapsed)}</aside>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" id="workspace-navigation" aria-label="Workspace navigation" showCloseButton={false} finalFocus={mobileTriggerRef} className={`gap-0 overflow-y-auto rounded-none border-0 bg-soft px-4 py-7 shadow-none data-[side=left]:h-dvh data-[side=left]:w-72 data-[side=left]:max-w-[calc(100vw-24px)] ${workspaceScrollbar}`}><SheetTitle className="sr-only">Workspace navigation</SheetTitle><SheetClose aria-label="Close navigation" render={<Button variant="ghost" size="icon-sm" className="absolute end-3 top-3" />}><X className="size-4" aria-hidden /></SheetClose>{sidebar(false)}</SheetContent></Sheet>
    <div ref={panelRef} role="region" aria-label="Workspace content" className={`min-h-0 min-w-0 flex-1 scroll-pt-16 overflow-y-auto overscroll-y-contain bg-canvas [scrollbar-gutter:stable] lg:my-2 lg:me-2 lg:rounded-[20px] ${workspaceScrollbar}`}>
      <a href="#main-content" className="sr-only z-60 rounded-xl bg-white p-3 focus:not-sr-only focus:fixed focus:start-2 focus:top-2">Skip to content</a>
      <header className="surface-inset sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 px-5 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Tooltip><TooltipTrigger render={<Button size="icon" variant="ghost" className="hidden size-9 min-w-0 shrink-0 text-muted-foreground lg:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-sidebar" onClick={toggleSidebar} />}>{collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}</TooltipTrigger><TooltipContent side="bottom">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent></Tooltip><Button ref={mobileTriggerRef} size="icon" variant="ghost" className="shrink-0 lg:hidden" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={mobileOpen} aria-controls={mobileOpen ? "workspace-navigation" : undefined} onClick={() => setMobileOpen(true)}><Menu className="size-5" /></Button><span className="hidden text-sm text-muted-foreground sm:inline">Workspace</span><ChevronRight className="hidden size-3.5 text-muted-foreground/60 sm:block" aria-hidden /><span className="truncate text-sm text-foreground">{current}</span></div><div className="flex shrink-0 items-center gap-2">{active !== "/onboarding" ? <HelpCheckin compact /> : null}{!preview ? <WorkspaceInbox /> : null}</div></header>
      {preview ? <div className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-soft px-3 py-2.5 text-xs leading-5 text-muted-foreground sm:mx-6"><span>{pathname === "/preview/onboarding" || pathname === "/onboarding" ? "Sample onboarding · Changes stay in this tab." : active === "/open-doors" ? "Sample Open Doors · Changes stay in this tab." : active === "/sprint" ? "Sample Sprint · Changes stay in this tab." : active === "/opportunities" ? "Workspace preview · Sample cohort. Bookmarks are temporary." : "Workspace preview · Sample cohort. Changes are disabled."}</span><Link href="/sign-in" className="inline-flex items-center gap-1.5 rounded-sm font-medium text-forest underline-offset-4 hover:underline">Sign in to your account</Link></div> : null}
      <main id="main-content" tabIndex={-1} className="px-5 py-8 sm:px-6 lg:mx-3 lg:mt-4"><div className="mx-auto w-full max-w-[1200px]">{children}</div></main>
      <footer className="mx-auto max-w-[1280px] px-5 py-6 text-xs text-muted-foreground sm:px-6">Philoxenia OS <span className="mx-1 text-muted-foreground/50">·</span> By Hustle Hours</footer>
    </div>
  </div>;
}
