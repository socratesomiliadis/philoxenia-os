"use client";

import { Modal } from "@heroui/react";
import { ArrowUpRight, Bookmark, Building2, CalendarDays, Check, DoorOpen, MapPin, UserRound, UsersRound } from "lucide-react";
import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { categoryLabels, costLabels, eventTimeLabel, opportunityTimeLabel, kindLabels, matchOpportunity, type Opportunity, type RecommendationContext } from "@/lib/opportunities";
import { ActionButton, Badge, InlineError } from "./ui";
import { useModalNotifications } from "./notification-context";

export const kindIcons = { event: CalendarDays, startup: Building2, founder: UserRound, alumni: DoorOpen };

export function SelectField({ label, children, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <div className="flex min-w-0 flex-col gap-2 text-xs font-medium text-muted"><label htmlFor={fieldId}>{label}</label><select {...props} id={fieldId} className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-normal text-foreground shadow-control">{children}</select></div>;
}

export function OpportunityModal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  useModalNotifications();
  const headingId = useId();
  return <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}><Modal.Backdrop><Modal.Container size="lg"><Modal.Dialog aria-label={title} className="rounded-[24px] bg-white p-5 sm:p-7"><Modal.CloseTrigger aria-label="Close opportunity" /><Modal.Header className="mb-5 pe-8"><Modal.Heading id={headingId} className="text-2xl font-medium tracking-tight wrap-anywhere text-foreground">{title}</Modal.Heading></Modal.Header><Modal.Body className="@container/opportunity-dialog scrollbar-thin min-h-0 wrap-anywhere [--scrollbar-thumb:var(--foreground)] [--scrollbar-track:transparent]">{children}</Modal.Body>{footer ? <Modal.Footer className="block shrink-0 border-t border-line pt-4">{footer}</Modal.Footer> : null}</Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>;
}

export function BookmarkButton({ entry, busy, onBookmark }: { entry: Opportunity; busy: boolean; onBookmark: (entry: Opportunity) => void }) {
  return <ActionButton appearance="secondary" aria-label={`${entry.saved ? "Unsave" : "Save"} ${entry.title}`} aria-pressed={entry.saved} isDisabled={busy} onPress={() => onBookmark(entry)} className={`relative z-10 size-10 min-h-10 min-w-10 shrink-0 rounded-lg px-0 shadow-none ${entry.saved ? "border-forest/20 bg-sage text-forest" : "text-muted"}`}><Bookmark className={`size-[18px] ${entry.saved ? "fill-forest text-forest" : "text-muted"}`} aria-hidden /></ActionButton>;
}

export function OpportunityCard({ entry, context, busy, onBookmark, onOpen }: { entry: Opportunity; context: RecommendationContext; busy: boolean; onBookmark: (entry: Opportunity) => void; onOpen: () => void }) {
  const match = matchOpportunity(entry, context);
  const Icon = kindIcons[entry.kind];
  return <article className="@container/opportunity group relative flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5 transition-colors duration-150 hover:border-forest/25 focus-within:border-forest/40">
    <div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${entry.kind === "alumni" ? "bg-sage text-forest" : "bg-soft text-muted"}`}><Icon className="size-[18px]" strokeWidth={1.7} aria-hidden /></span><span className="text-xs text-muted">{kindLabels[entry.kind]}</span>{entry.organizerPick ? <span className="hidden rounded-md bg-warm px-2 py-1 text-[11px] text-[#806832] @min-[380px]/opportunity:inline">Organizer pick</span> : null}</div><BookmarkButton entry={entry} busy={busy} onBookmark={onBookmark} /></div>
    <div className="grid min-w-0 flex-1 gap-x-8 gap-y-4 @min-[640px]/opportunity:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 wrap-anywhere">
        <h2 className="text-xl leading-7 font-medium tracking-[-0.035em] text-foreground @min-[640px]/opportunity:text-2xl">{entry.title}</h2>
        {entry.sourceCancelled ? <p className="mt-2 text-sm text-red-700">Cancelled by source</p> : null}
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{entry.summary}</p>
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">{entry.interests.slice(0, 2).map((interest) => <span key={interest} className="max-w-full rounded-md bg-soft px-2 py-1 text-[11px] leading-5 text-muted wrap-anywhere">{interest}</span>)}{entry.interests.length > 2 ? <span className="text-[11px] leading-5 text-muted">+{entry.interests.length - 2} interests</span> : null}</div>
      </div>
      <div className="min-w-0 space-y-2.5 text-xs leading-5 text-muted wrap-anywhere">
        {entry.startAt !== undefined || entry.eventDate ? <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>{opportunityTimeLabel(entry)}</span></p> : null}
        <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>{entry.location}</span></p>
        {entry.kind === "alumni" && entry.support ? <p className="flex items-start gap-2"><UsersRound className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>Support from {entry.support.offeredBy}</span></p> : null}
        <p className="text-[11px] text-muted">{entry.kind === "event" ? `${costLabels[entry.cost ?? "unknown"]}${entry.costNote ? ` · ${entry.costNote}` : ""}` : entry.kind === "alumni" ? "Confirmed support path" : "Public directory"}</p>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-soft/75 px-3 py-2">
      <p className={`min-w-0 flex-1 basis-36 text-[11px] leading-5 wrap-anywhere ${match.reasons[0] ? "text-forest" : "text-muted"}`}>{match.reasons[0] ? <span className="flex items-start gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />{match.reasons[0]}</span> : entry.primarySourceId ? "Imported from the original source" : "Curated by your organizers"}</p>
      <button onClick={onOpen} aria-label={`View ${entry.title}`} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-forest after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none! focus-visible:after:outline-2 focus-visible:after:outline-offset-3 focus-visible:after:outline-forest">View details</button>
    </div>
  </article>;
}

export function OpportunityDetails({ entry, context, busy, error, notice, onBookmark, onClose, onAddToSprint }: { entry?: Opportunity; context: RecommendationContext; busy: boolean; error?: string | null; notice?: string; onBookmark: (entry: Opportunity) => void; onClose: () => void; onAddToSprint?: () => void }) {
  if (!entry) return <OpportunityModal title="Opportunity unavailable" onClose={onClose}><p className="text-sm leading-6 text-muted">This listing is no longer published. Close this view to explore other opportunities.</p><ActionButton className="mt-5" onPress={onClose}>Back to opportunities</ActionButton></OpportunityModal>;
  const match = matchOpportunity(entry, context);
  return <OpportunityModal title={entry.title} onClose={onClose} footer={
    <div className="space-y-3">
      <InlineError message={error ?? null} />
      {entry.isSample ? <p className="text-xs leading-5 text-muted">Illustrative sample. No registration or support request is available.</p> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        {!entry.isSample ? <a href={entry.support?.url ?? entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-center text-sm font-medium text-white transition-[background-color,transform] duration-150 ease-ui hover:bg-forest/90 active:scale-[0.98]">{entry.kind === "event" ? "View registration" : entry.kind === "alumni" ? "Request support on provider site" : "Visit original source"}<ArrowUpRight className="size-4 shrink-0" aria-hidden /></a> : null}
        <ActionButton appearance="secondary" isDisabled={busy} onPress={() => onBookmark(entry)}><Bookmark className={`size-4 ${entry.saved ? "fill-forest" : ""}`} aria-hidden />{entry.saved ? "Unsave opportunity" : "Save opportunity"}</ActionButton>
        {onAddToSprint ? <ActionButton appearance="secondary" isDisabled={entry.sourceCancelled} onPress={onAddToSprint}><CalendarDays className="size-4" aria-hidden />Add to Sprint</ActionButton> : null}
      </div>
      {notice ? <p role="status" className="rounded-lg bg-sage px-3 py-2 text-xs leading-5 text-forest">{notice}</p> : null}
    </div>
  }><div className="space-y-5">
    <div className="space-y-3"><div className="flex flex-wrap gap-2"><Badge>{kindLabels[entry.kind]}</Badge>{entry.organizerPick ? <Badge tone="gold">Organizer pick</Badge> : null}{entry.isSample ? <Badge>Sample listing</Badge> : null}</div><p className="text-base leading-7 text-foreground">{entry.summary}</p></div>
    <section aria-label="Listing details" className="space-y-3 rounded-2xl bg-soft p-4 text-sm leading-6 text-muted">
      <p className="flex items-start gap-2.5"><MapPin className="mt-1 size-4 shrink-0 text-forest" aria-hidden /><span>{entry.location}</span></p>
      {entry.startAt !== undefined || entry.eventDate ? <>
        <div className="flex items-start gap-2.5"><CalendarDays className="mt-1 size-4 shrink-0 text-forest" aria-hidden /><div className="min-w-0"><p className="font-medium text-foreground">{opportunityTimeLabel(entry)}</p>{entry.endAt !== undefined ? <p className="mt-1 text-xs leading-5">Ends {eventTimeLabel(entry.endAt)}</p> : null}</div></div>
        <p className="border-t border-line pt-3 text-xs leading-5"><span className="font-medium text-foreground">{costLabels[entry.cost ?? "unknown"]}</span>{entry.costNote ? ` · ${entry.costNote}` : ""}</p>
      </> : null}
    </section>
    <section className="space-y-2"><h3 className="text-sm font-medium text-foreground">About this opportunity</h3><p className="text-sm leading-7 whitespace-pre-wrap wrap-anywhere text-muted">{entry.description}</p></section>
    <div className="flex flex-wrap gap-1.5">{entry.interests.map((interest) => <span key={interest} className="max-w-full rounded-md bg-soft px-2.5 py-1 text-xs leading-5 text-muted wrap-anywhere">{interest}</span>)}</div>
    {match.reasons.length ? <section className="rounded-2xl bg-sage/55 p-4"><h3 className="text-sm font-medium text-foreground">Why this is here for you</h3><ul className="mt-3 space-y-2">{match.reasons.map((reason) => <li key={reason} className="flex items-start gap-2 text-xs leading-5 text-muted"><Check className="mt-0.5 size-3.5 shrink-0 text-forest" aria-hidden />{reason}</li>)}</ul><p className="mt-3 text-xs leading-5 text-muted">Based on your cohort’s interests, confirmed mission, stay dates, and organizer picks.</p></section> : null}
    {entry.kind === "alumni" && entry.support ? <section className="space-y-3 rounded-2xl border border-line p-4"><h3 className="text-base font-medium text-foreground">Support from {entry.support.offeredBy}</h3><p className="text-sm leading-6 whitespace-pre-wrap text-muted">{entry.support.pathway}</p><div className="space-y-1"><h4 className="text-xs font-medium text-foreground">Availability</h4><p className="text-sm leading-6 text-muted">{entry.support.availability}</p></div><p className="text-xs leading-5 text-muted">Your organizer confirmed this support path. Request it through the provider’s form; availability is subject to their reply.</p></section> : entry.kind !== "event" ? <p className="rounded-xl bg-soft p-4 text-sm leading-6 text-muted">Public directory entry. An introduction, meeting, or visit has not been arranged.</p> : <p className="text-xs leading-5 text-muted">Registration, approval, and current availability are handled by the original event platform.</p>}
    {entry.categories.length ? <p className="text-xs leading-5 text-muted">Useful for: {entry.categories.map((category) => categoryLabels[category]).join(" · ")}</p> : null}
    {entry.eventDate ? <p className="text-xs leading-6 text-muted">This is an all-day calendar entry. Adding it to your Sprint creates an untimed planning task; confirm the event time before scheduling.</p> : null}
    {entry.sourceCancelled ? <p role="status" className="rounded-xl bg-warm p-4 text-sm leading-6">The source reports this event as cancelled. Check the original page for updates.</p> : null}
    {entry.approvalRequired !== undefined ? <p className="text-xs leading-5 text-muted">{entry.approvalRequired ? "Registration requires host approval." : "Source reports no host approval requirement. Check registration for current availability."}</p> : null}
    {entry.lastImportedAt ? <p className="text-xs leading-5 text-muted">Last imported: {eventTimeLabel(entry.lastImportedAt)}. {entry.sourceStale ? "Source data is stale. Check registration before planning." : "Check the source for the latest details."}</p> : null}
    <p className="text-xs leading-5 wrap-anywhere text-muted">Source: {entry.isSample ? entry.sourceName : <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-forest underline underline-offset-4">{entry.sourceName}</a>}</p>
  </div></OpportunityModal>;
}
