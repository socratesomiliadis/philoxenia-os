"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ChevronsUpDown, LogIn, LogOut, Settings2, UserRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useWorkspace } from "./workspace-context";
import { WorkspaceDialog } from "./workspace-dialog";
import { ProfileEditor } from "./community-profile";
import { CheckboxField } from "./ui";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

function AccountProfileEditor({ onClose }: { onClose: () => void }) {
  const { viewer } = useWorkspace();
  const save = useMutation(api.users.saveCommunity);
  return <ProfileEditor input={viewer?.profile?.community ?? { bio: "", building: "", interests: "", offering: "" }} onSave={async (input) => { await save({ input }); onClose(); }} onClose={onClose} />;
}

export function WorkspaceAccountMenu({ compact, collapsed, onToggleSidebar }: { compact: boolean; collapsed: boolean; onToggleSidebar: () => void }) {
  const { preview, viewer } = useWorkspace();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<"settings" | "profile" | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const name = viewer?.name ?? "Workspace preview";
  const role = preview ? "Local preview" : viewer?.isOrganizer ? "Organizer" : viewer?.profile?.isAlumni ? "Alumnus" : "Hustler";

  function closePanel() {
    setPanel(null);
    triggerRef.current?.focus();
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setSignOutError("Could not sign out. Try again.");
      setSigningOut(false);
    }
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger ref={triggerRef} aria-label={`Account menu for ${name}`} render={<Button variant="ghost" className="h-14 w-full min-w-0 justify-start gap-3 overflow-hidden rounded-xl p-1.5 text-start" />}>
        <span data-slot="account-avatar" aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-medium text-forest">{name.charAt(0).toUpperCase()}</span>
        <span aria-hidden={compact} className={`flex w-[156px] shrink-0 items-center gap-2 transition-opacity duration-100 ease-ui motion-reduce:transition-none ${compact ? "opacity-0" : "opacity-100"}`}>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{name}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{role}</span></span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5 shadow-lg motion-reduce:animate-none">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-3 font-normal">
            <span className="block text-sm font-medium wrap-anywhere text-foreground">{name}</span>
            {viewer?.email ? <span className="mt-1 block text-xs wrap-anywhere">{viewer.email}</span> : null}
            <span className="mt-1 block text-xs">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1 my-1 bg-border/60" />
          {!preview ? <DropdownMenuItem className="min-h-10 gap-3 rounded-lg px-3" onClick={() => setPanel("profile")}><UserRound aria-hidden />Community profile</DropdownMenuItem> : null}
          <DropdownMenuItem className="min-h-10 gap-3 rounded-lg px-3" onClick={() => setPanel("settings")}><Settings2 aria-hidden />Settings</DropdownMenuItem>
          <DropdownMenuSeparator className="mx-1 my-1 bg-border/60" />
          {preview ? <DropdownMenuItem render={<Link href="/sign-in" />} className="min-h-10 gap-3 rounded-lg px-3"><LogIn aria-hidden />Sign in</DropdownMenuItem> : <DropdownMenuItem variant="destructive" disabled={signingOut} closeOnClick={false} onClick={signOut} className="min-h-10 gap-3 rounded-lg px-3"><LogOut aria-hidden />{signingOut ? "Signing out…" : "Sign out"}</DropdownMenuItem>}
        </DropdownMenuGroup>
        {signOutError ? <p role="alert" className="m-1 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-800">{signOutError}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
    {panel === "settings" ? <WorkspaceDialog title="Settings" size="compact" onClose={closePanel} closeLabel="Close settings">
      <div className="space-y-8">
        <section className="space-y-3"><h2 className="text-sm font-medium text-foreground">Your account</h2><div className="rounded-2xl bg-soft p-4"><p className="font-medium text-foreground">{name}</p>{viewer?.email ? <p className="mt-1 text-sm">{viewer.email}</p> : null}<p className="mt-1 text-xs">{role}</p></div></section>
        <section className="space-y-3"><h2 className="text-sm font-medium text-foreground">Workspace</h2><CheckboxField checked={collapsed} onCheckedChange={onToggleSidebar} description="Use a compact sidebar on desktop. This preference is saved in this browser.">Collapse sidebar</CheckboxField></section>
      </div>
    </WorkspaceDialog> : null}
    {panel === "profile" && !preview ? <AccountProfileEditor onClose={closePanel} /> : null}
  </>;
}
