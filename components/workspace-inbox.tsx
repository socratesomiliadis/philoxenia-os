"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActionButton, Badge, InlineError, LoadingState, errorMessage } from "./ui";
import { OpportunityModal } from "./opportunity-parts";
import type { Id } from "@/convex/_generated/dataModel";

export function WorkspaceInbox() {
  const notifications = useQuery(api.notifications.inbox), read = useMutation(api.notifications.read);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const unread = notifications?.filter((item) => !item.readAt).length ?? 0;
  return <><ActionButton appearance="secondary" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="min-h-10 px-3" onPress={() => setOpen(true)}><Bell className="size-4" aria-hidden />{unread ? <span className="text-xs tabular-nums">{unread}</span> : null}</ActionButton>{open ? <OpportunityModal title="Your notifications" onClose={() => setOpen(false)}>{!notifications ? <LoadingState /> : notifications.length ? <ul className="space-y-3">{notifications.map((item) => <li key={item._id} className={`space-y-3 rounded-xl border border-line p-4 ${!item.readAt ? "bg-sage/30" : ""}`}><p className="text-sm leading-6 wrap-anywhere">{item.message}</p><div className="flex flex-wrap items-center gap-3"><Link href="/open-doors" onClick={() => setOpen(false)} className="text-xs font-medium text-forest hover:underline">Open Doors</Link>{!item.readAt ? <ActionButton appearance="secondary" busy={busy === item._id} onPress={async () => { setBusy(item._id); setError(null); try { await read({ notificationId: item._id }); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(null); } }}>Mark as read</ActionButton> : <Badge>Read</Badge>}</div></li>)}</ul> : <p className="text-sm leading-6 text-muted">Invitation and support updates will appear here.</p>}<InlineError message={error} /></OpportunityModal> : null}</>;
}

export function DeliveryManager() {
  const deliveries = useQuery(api.notifications.deliveries), retry = useMutation(api.notifications.retry);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  async function resend(id: Id<"emailDeliveries">) { setBusy(id); setError(null); try { await retry({ deliveryId: id }); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(null); } }
  return <details className="rounded-2xl border border-line p-5"><summary className="cursor-pointer text-sm font-medium">Email delivery status</summary><p className="mt-3 text-xs leading-5 text-muted">Actions remain saved if email fails. In-app notifications are available immediately.</p><InlineError message={error} /><ul className="mt-4 space-y-3">{deliveries?.map((item) => <li key={item._id} className="space-y-2 border-t border-line pt-3"><div className="flex flex-wrap items-start justify-between gap-3"><p className="min-w-0 flex-1 text-sm leading-6 wrap-anywhere">{item.message}</p><Badge tone={item.status === "sent" ? "green" : "neutral"}>{item.status}</Badge></div>{item.error ? <p className="text-xs leading-5 text-muted">{item.error}</p> : null}{["failed", "disabled"].includes(item.status) ? <ActionButton appearance="secondary" busy={busy === item._id} onPress={() => void resend(item._id)}>Retry email</ActionButton> : null}</li>)}</ul>{deliveries?.length === 0 ? <p className="mt-4 text-sm text-muted">No email deliveries yet.</p> : null}</details>;
}
