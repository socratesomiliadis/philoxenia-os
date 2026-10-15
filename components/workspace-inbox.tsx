"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, Check, LoaderCircle } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActionButton, Badge, InlineError, errorMessage } from "./ui";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "./ui/popover";
import { useModalNotifications } from "./notification-context";
import type { Id } from "@/convex/_generated/dataModel";

export function WorkspaceInbox() {
  const notifications = useQuery(api.notifications.inbox), read = useMutation(api.notifications.read);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const unread = notifications?.filter((item) => !item.readAt).length ?? 0;
  useModalNotifications(open);
  async function markRead(notificationId: Id<"notifications">) {
    setBusy(notificationId); setError(null);
    try { await read({ notificationId }); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(null); }
  }
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
    <PopoverTrigger render={<ActionButton appearance="secondary" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="min-h-10 px-3" />}><Bell className="size-4" aria-hidden />{unread ? <span className="text-xs tabular-nums">{unread > 99 ? "99+" : unread}</span> : null}</PopoverTrigger>
    <PopoverContent align="end" sideOffset={12} className="w-[min(24rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-2xl surface-overlay p-0 text-foreground shadow-lg ring-0 motion-reduce:animate-none">
      <div className="flex items-center justify-between gap-3 px-5 py-4"><PopoverTitle className="text-base font-medium">Notifications</PopoverTitle>{unread ? <Badge tone="green">{unread} unread</Badge> : null}</div>
      <div className="scrollbar-thin max-h-[min(26rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain">
        {!notifications ? <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden />Loading notifications…</p> : notifications.length ? <ul className="space-y-1 px-2 pb-2">{notifications.map((item) => <li key={item._id} className={`space-y-3 rounded-xl px-3 py-4 ${!item.readAt ? "bg-sage/30" : ""}`}>
          <div className="flex items-start gap-2.5">{!item.readAt ? <span className="mt-2 size-1.5 shrink-0 rounded-full bg-forest" aria-label="Unread" /> : <Check className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-label="Read" />}<div className="min-w-0 space-y-1"><p className="text-sm leading-6 wrap-anywhere">{item.message}</p><time dateTime={new Date(item.createdAt).toISOString()} className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(item.createdAt)}</time></div></div>
          <div className="flex flex-wrap items-center justify-between gap-2 ps-4"><Link href={item.requestId ? "/open-doors" : "/"} onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-forest underline-offset-4 hover:underline">{item.requestId ? "View Open Doors" : "View workspace"}<ArrowUpRight className="size-3" aria-hidden /></Link>{!item.readAt ? <ActionButton appearance="secondary" className="min-h-9 px-2.5 text-xs shadow-none" busy={busy === item._id} disabled={busy !== null} onClick={() => void markRead(item._id)}>Mark as read</ActionButton> : null}</div>
        </li>)}</ul> : <div className="px-6 py-10 text-center"><Bell className="mx-auto mb-3 size-6 text-forest" aria-hidden /><p className="text-sm font-medium">You’re all caught up.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Invitation and support updates will appear here.</p></div>}
      </div>
      {error ? <div className="p-3"><InlineError message={error} /></div> : null}
    </PopoverContent>
  </Popover>;
}

export function DeliveryManager() {
  const deliveries = useQuery(api.notifications.deliveries), retry = useMutation(api.notifications.retry);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  async function resend(id: Id<"emailDeliveries">) { setBusy(id); setError(null); try { await retry({ deliveryId: id }); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(null); } }
  return <details className="rounded-2xl surface-inset p-5"><summary className="cursor-pointer text-sm font-medium">Email delivery status</summary><p className="mt-3 text-xs leading-5 text-muted-foreground">Actions remain saved if email fails. In-app notifications are available immediately.</p><InlineError message={error} /><ul className="mt-4 space-y-3">{deliveries?.map((item) => <li key={item._id} className="space-y-2 pt-3"><div className="flex flex-wrap items-start justify-between gap-3"><p className="min-w-0 flex-1 text-sm leading-6 wrap-anywhere">{item.message}</p><Badge tone={item.status === "sent" ? "green" : "neutral"}>{item.status}</Badge></div>{item.error ? <p className="text-xs leading-5 text-muted-foreground">{item.error}</p> : null}{["failed", "disabled"].includes(item.status) ? <ActionButton appearance="secondary" busy={busy === item._id} onClick={() => void resend(item._id)}>Retry email</ActionButton> : null}</li>)}</ul>{deliveries?.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No email deliveries yet.</p> : null}</details>;
}
