"use client";

import { Modal } from "@heroui/react";
import { ArrowUpRight, Bookmark, Building2, CalendarDays, Check, DoorOpen, MapPin, UserRound } from "lucide-react";
import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { categoryLabels, costLabels, eventTimeLabel, kindLabels, matchOpportunity, type Opportunity, type RecommendationContext } from "@/lib/opportunities";
import { ActionButton, Badge, IconTile, InlineError } from "./ui";

export const kindIcons = { event: CalendarDays, startup: Building2, founder: UserRound, alumni: DoorOpen };

export function SelectField({ label, children, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <div className="flex min-w-0 flex-col gap-2 text-xs font-medium text-muted"><label htmlFor={fieldId}>{label}</label><select {...props} id={fieldId} className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-normal text-foreground shadow-control">{children}</select></div>;
}

export function OpportunityModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const headingId = useId();
  return <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}><Modal.Backdrop><Modal.Container size="lg"><Modal.Dialog aria-labelledby={headingId} className="rounded-[24px] bg-white p-5 sm:p-7"><Modal.CloseTrigger aria-label="Close opportunity" /><Modal.Header className="mb-5 pe-8"><Modal.Heading id={headingId} className="text-2xl font-medium tracking-tight wrap-anywhere text-foreground">{title}</Modal.Heading></Modal.Header><Modal.Body className="scrollbar-thin min-h-0 wrap-anywhere [--scrollbar-thumb:var(--foreground)] [--scrollbar-track:transparent]">{children}</Modal.Body></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>;
}

export function BookmarkButton({ entry, busy, onBookmark }: { entry: Opportunity; busy: boolean; onBookmark: (entry: Opportunity) => void }) {
  return <ActionButton appearance="secondary" aria-label={`${entry.saved ? "Unsave" : "Save"} ${entry.title}`} aria-pressed={entry.saved} isDisabled={busy} onPress={() => onBookmark(entry)} className="size-11 min-w-11 shrink-0 px-0"><Bookmark className={`size-[18px] ${entry.saved ? "fill-forest text-forest" : "text-muted"}`} aria-hidden /></ActionButton>;
}

export function OpportunityCard({ entry, context, busy, onBookmark, onOpen }: { entry: Opportunity; context: RecommendationContext; busy: boolean; onBookmark: (entry: Opportunity) => void; onOpen: () => void }) {
  const match = matchOpportunity(entry, context);
  return <article className="flex min-w-0 flex-col rounded-[24px] border border-line bg-white p-5 wrap-anywhere sm:p-6">
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><IconTile icon={kindIcons[entry.kind]} tone={entry.kind === "alumni" ? "green" : "neutral"} /><span className="text-xs text-muted">{kindLabels[entry.kind]}</span></div><BookmarkButton entry={entry} busy={busy} onBookmark={onBookmark} /></div>
    <h2 className="mt-5 text-xl leading-7 font-medium tracking-tight wrap-anywhere text-foreground"><button onClick={onOpen} className="rounded-sm text-start underline-offset-4 hover:underline">{entry.title}</button></h2>
    <p className="mt-2 text-sm leading-6 text-muted">{entry.summary}</p>
    <div className="mt-5 space-y-2 text-xs leading-5 text-muted">
      {entry.startAt !== undefined ? <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>{eventTimeLabel(entry.startAt)}</span></p> : null}
      <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span className="wrap-anywhere">{entry.location}</span></p>
      {entry.kind === "event" ? <p>{entry.cost ? costLabels[entry.cost] : costLabels.unknown}{entry.costNote ? ` · ${entry.costNote}` : ""}</p> : null}
    </div>
    <div className="mt-4 flex flex-wrap gap-2 [&>span]:max-w-full">{entry.interests.map((interest) => <Badge key={interest}>{interest}</Badge>)}</div>
    <div className="mt-auto pt-5">
      <div className="min-h-6 text-xs leading-5 text-forest">{match.reasons[0] ? <p className="flex items-start gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />{match.reasons[0]}{match.reasons.length > 1 ? ` · +${match.reasons.length - 1} more` : ""}</p> : <p className="text-muted">Curated by your organizers</p>}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><span className="text-xs text-muted">{entry.kind === "alumni" ? "Confirmed support path" : entry.kind === "event" ? "Register on original site" : "Public directory"}</span><button onClick={onOpen} aria-label={`View ${entry.title}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-forest underline-offset-4 hover:underline">View details<ArrowUpRight className="size-4" aria-hidden /></button></div>
    </div>
  </article>;
}

export function OpportunityDetails({ entry, context, busy, error, notice, onBookmark, onClose, onAddToSprint }: { entry?: Opportunity; context: RecommendationContext; busy: boolean; error?: string | null; notice?: string; onBookmark: (entry: Opportunity) => void; onClose: () => void; onAddToSprint?: () => void }) {
  if (!entry) return <OpportunityModal title="Opportunity unavailable" onClose={onClose}><p className="text-sm leading-6 text-muted">This listing is no longer published. Close this view to explore other opportunities.</p><ActionButton className="mt-5" onPress={onClose}>Back to opportunities</ActionButton></OpportunityModal>;
  const match = matchOpportunity(entry, context);
  return <OpportunityModal title={entry.title} onClose={onClose}><div className="space-y-6">
    <div className="flex flex-wrap gap-2"><Badge>{kindLabels[entry.kind]}</Badge>{entry.organizerPick ? <Badge tone="gold">Organizer pick</Badge> : null}{entry.isSample ? <Badge>Sample listing</Badge> : null}</div>
    <p className="text-base leading-7 text-foreground">{entry.summary}</p>
    <div className="space-y-2 text-sm leading-6 text-muted"><p className="flex items-start gap-2"><MapPin className="mt-1 size-4 shrink-0" aria-hidden /><span>{entry.location}</span></p>{entry.startAt !== undefined ? <div><p>{eventTimeLabel(entry.startAt)}</p>{entry.endAt !== undefined ? <p>Ends {eventTimeLabel(entry.endAt)}</p> : null}<p className="mt-2">{costLabels[entry.cost ?? "unknown"]}{entry.costNote ? ` · ${entry.costNote}` : ""}</p><p className="mt-2 text-xs">Registration, approval requirements, and current availability are managed by the original event platform.</p></div> : null}</div>
    <p className="text-sm leading-7 whitespace-pre-wrap wrap-anywhere text-muted">{entry.description}</p>
    <div className="flex flex-wrap gap-2 [&>span]:max-w-full">{entry.interests.map((interest) => <Badge key={interest}>{interest}</Badge>)}</div>
    {match.reasons.length ? <section className="rounded-2xl bg-soft p-5"><h3 className="text-sm font-medium text-foreground">Why this is here for you</h3><ul className="mt-3 space-y-2">{match.reasons.map((reason) => <li key={reason} className="flex items-start gap-2 text-sm leading-6 text-muted"><Check className="mt-1 size-4 shrink-0 text-forest" aria-hidden />{reason}</li>)}</ul><p className="mt-3 text-xs leading-5 text-muted">Based on your selected cohort’s interests, confirmed mission, stay dates, and organizer picks.</p></section> : null}
    {entry.kind === "alumni" && entry.support ? <section className="rounded-2xl border border-line p-5"><h3 className="text-base font-medium text-foreground">Support from {entry.support.offeredBy}</h3><p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-muted">{entry.support.pathway}</p><p className="mt-3 text-sm leading-6 text-muted">{entry.support.availability}</p><p className="mt-3 text-xs leading-5 text-muted">An organizer confirmed this support path. Use the provider’s form to request it; a booking or introduction is subject to their reply.</p></section> : entry.kind !== "event" ? <p className="rounded-2xl bg-soft p-4 text-sm leading-6 text-muted">Public directory entry. An introduction, meeting, or visit has not been arranged.</p> : null}
    {entry.categories.length ? <p className="text-xs leading-5 text-muted">Useful for: {entry.categories.map((category) => categoryLabels[category]).join(" · ")}</p> : null}
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">{entry.isSample ? <p className="w-full text-xs leading-5 text-muted">Illustrative sample. No registration or support request is available.</p> : <a href={entry.support?.url ?? entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-forest/90">{entry.kind === "event" ? "View registration" : entry.kind === "alumni" ? "Request support on provider site" : "Visit original source"}<ArrowUpRight className="size-4 shrink-0" aria-hidden /></a>}<ActionButton appearance="secondary" isDisabled={busy} onPress={() => onBookmark(entry)}><Bookmark className={`size-4 ${entry.saved ? "fill-forest" : ""}`} aria-hidden />{entry.saved ? "Unsave opportunity" : "Save opportunity"}</ActionButton></div>
    {onAddToSprint ? <ActionButton appearance="secondary" onPress={onAddToSprint}><CalendarDays className="size-4" aria-hidden />Add to Sprint</ActionButton> : null}
    <InlineError message={error ?? null} />{notice ? <p role="status" className="text-sm leading-6 text-forest">{notice}</p> : null}
    <p className="text-xs leading-5 wrap-anywhere text-muted">Source: {entry.isSample ? entry.sourceName : <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-forest underline underline-offset-4">{entry.sourceName}</a>}</p>
  </div></OpportunityModal>;
}
