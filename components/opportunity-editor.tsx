"use client";

import { useState, type FormEvent } from "react";
import { Label, TextArea, TextField } from "@heroui/react";
import { industries } from "@/lib/mission";
import { categoryLabels, missionCategories, opportunitySchema, parseSfDateTime, sfDateTimeInput, type MissionCategory, type Opportunity, type OpportunityInput } from "@/lib/opportunities";
import { ActionButton, Field, InlineError, errorMessage } from "./ui";
import { OpportunityModal, SelectField } from "./opportunity-parts";

function LongField({ label, value, onChange, maxLength, minLength, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; minLength?: number; rows?: number }) {
  return <TextField className="space-y-2" isRequired><Label className="text-sm font-medium text-foreground">{label}</Label><TextArea required value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} minLength={minLength} rows={rows} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6 shadow-control" /></TextField>;
}

export function OpportunityEditor({ entry, onClose, onSave }: { entry?: Opportunity; onClose: () => void; onSave: (input: OpportunityInput, confirmSupport: boolean) => Promise<void> }) {
  const [kind, setKind] = useState<OpportunityInput["kind"]>(entry?.kind ?? "event");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [summary, setSummary] = useState(entry?.summary ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [location, setLocation] = useState(entry?.location ?? "San Francisco");
  const [area, setArea] = useState<OpportunityInput["area"]>(entry?.area ?? "sf");
  const [sourceName, setSourceName] = useState(entry?.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(entry?.sourceUrl ?? "");
  const [interests, setInterests] = useState(entry?.interests ?? []);
  const [categories, setCategories] = useState<MissionCategory[]>(entry?.categories ?? []);
  const [status, setStatus] = useState<OpportunityInput["status"]>(entry?.status ?? "draft");
  const [organizerPick, setOrganizerPick] = useState(entry?.organizerPick ?? false);
  const [start, setStart] = useState(entry?.startAt === undefined ? "" : sfDateTimeInput(entry.startAt));
  const [end, setEnd] = useState(entry?.endAt === undefined ? "" : sfDateTimeInput(entry.endAt));
  const [cost, setCost] = useState<NonNullable<OpportunityInput["cost"]>>(entry?.cost ?? "unknown");
  const [costNote, setCostNote] = useState(entry?.costNote ?? "");
  const [offeredBy, setOfferedBy] = useState(entry?.support?.offeredBy ?? "");
  const [pathway, setPathway] = useState(entry?.support?.pathway ?? "");
  const [supportUrl, setSupportUrl] = useState(entry?.support?.url ?? "");
  const [availability, setAvailability] = useState(entry?.support?.availability ?? "");
  const [confirmSupport, setConfirmSupport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allInterests = [...new Set([...industries, ...(entry?.interests ?? [])])];

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    try {
      const input = opportunitySchema.safeParse({ kind, title, summary, description, interests, categories, area, location, sourceName, sourceUrl, organizerPick, status,
        ...(kind === "event" ? { startAt: start ? parseSfDateTime(start) : undefined, endAt: end ? parseSfDateTime(end) : undefined, cost, costNote: costNote.trim() || undefined } : {}),
        ...(kind === "alumni" ? { support: { offeredBy, pathway, url: supportUrl, availability } } : {}),
      });
      if (!input.success) { setError(input.error.issues[0].message); return; }
      if (kind === "alumni" && status === "published" && !confirmSupport) { setError("Confirm the alumnus agreed to this offer and request path before publishing."); return; }
      setBusy(true);
      await onSave(input.data, confirmSupport);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  return <OpportunityModal title={entry ? "Edit opportunity" : "Add opportunity"} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Type" value={kind} onChange={(event) => { setKind(event.target.value as OpportunityInput["kind"]); setConfirmSupport(false); }}><option value="event">Event</option><option value="startup">Startup</option><option value="founder">Founder</option><option value="alumni">Alumni offer</option></SelectField><SelectField label="Publication status" value={status} onChange={(event) => setStatus(event.target.value as OpportunityInput["status"])}><option value="draft">Draft · organizers only</option><option value="published">Published · all members</option><option value="archived">Archived · organizers only</option></SelectField></div>
    <Field label="Title" required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Founders & product feedback" />
    <LongField label="Short summary" value={summary} onChange={setSummary} minLength={10} maxLength={240} rows={2} />
    <LongField label="Details and what to expect" value={description} onChange={setDescription} minLength={20} maxLength={5000} rows={5} />
    <fieldset><legend className="mb-3 text-sm font-medium text-foreground">Interests (choose up to 8)</legend><div className="flex flex-wrap gap-2">{allInterests.map((interest) => <label key={interest} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs ${interests.includes(interest) ? "border-forest/30 bg-sage text-forest" : "border-line text-muted"}`}><input type="checkbox" className="size-4 accent-forest" checked={interests.includes(interest)} disabled={interests.length >= 8 && !interests.includes(interest)} onChange={(event) => setInterests((items) => event.target.checked ? [...items, interest] : items.filter((item) => item !== interest))} />{interest}</label>)}</div></fieldset>
    <fieldset><legend className="mb-3 text-sm font-medium text-foreground">Useful for</legend><div className="grid gap-2 sm:grid-cols-2">{missionCategories.map((category) => <label key={category} className="flex min-h-10 items-center gap-2 text-sm text-muted"><input type="checkbox" className="size-4 accent-forest" checked={categories.includes(category)} onChange={(event) => setCategories((items) => event.target.checked ? [...items, category] : items.filter((item) => item !== category))} />{categoryLabels[category]}</label>)}</div></fieldset>
    <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Area" value={area} onChange={(event) => setArea(event.target.value as OpportunityInput["area"])}><option value="sf">San Francisco</option><option value="bay-area">Wider Bay Area</option><option value="online">Online</option></SelectField><Field label="Location / venue" required minLength={2} maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} /></div>
    {kind === "event" ? <fieldset className="space-y-4 rounded-2xl border border-line p-4"><legend className="px-1 text-sm font-medium text-foreground">Event details</legend><p className="text-xs leading-5 text-muted">Enter dates and times in San Francisco time (America/Los_Angeles). If the venue is unannounced, say so in the location.</p><Field label="Starts (SF time)" type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} /><Field label="Ends (SF time, optional)" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /><SelectField label="Cost" value={cost} onChange={(event) => setCost(event.target.value as typeof cost)}><option value="unknown">Price not confirmed</option><option value="free">Free</option><option value="paid">Paid</option></SelectField><Field label="Price or registration notes (optional)" maxLength={160} value={costNote} onChange={(event) => setCostNote(event.target.value)} placeholder="From $20 · approval required" /><p className="text-xs leading-5 text-muted">Use the original event’s registration page as the source link below.</p></fieldset> : null}
    {kind === "alumni" ? <fieldset className="space-y-4 rounded-2xl border border-line p-4"><legend className="px-1 text-sm font-medium text-foreground">Confirmed support path</legend><p className="text-xs leading-5 text-muted">Only list support the alumnus agreed to provide. For introductions, describe a connection they can actually facilitate.</p><Field label="Alumnus offering support" required minLength={2} maxLength={100} value={offeredBy} onChange={(event) => setOfferedBy(event.target.value)} /><LongField label="Support and how to request it" value={pathway} onChange={setPathway} minLength={10} maxLength={1000} /><Field label="Request / booking URL" type="url" required value={supportUrl} onChange={(event) => setSupportUrl(event.target.value)} maxLength={2000} placeholder="https://cal.com/example/product-review" /><Field label="Availability and capacity" required minLength={5} maxLength={240} value={availability} onChange={(event) => setAvailability(event.target.value)} placeholder="Two 30-minute reviews during the November cohort" /><label className="flex items-start gap-3 text-sm leading-6 text-foreground"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-forest" checked={confirmSupport} onChange={(event) => setConfirmSupport(event.target.checked)} required={status === "published"} /><span>I confirmed this offer, availability, and request path with the alumnus.</span></label></fieldset> : kind !== "event" ? <p className="rounded-xl bg-soft p-4 text-xs leading-6 text-muted">Startup and founder entries are public directory listings. They do not promise an introduction, meeting, or office visit.</p> : null}
    <Field label="Original source name" required minLength={2} maxLength={100} value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Luma · event organizer" />
    <Field label="Original source URL" type="url" required maxLength={2000} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://lu.ma/example" />
    <label className="flex min-h-11 items-center gap-3 text-sm text-foreground"><input type="checkbox" className="size-4 accent-forest" checked={organizerPick} onChange={(event) => setOrganizerPick(event.target.checked)} />Recommend as an organizer pick</label>
    <p className="text-xs leading-5 text-muted">{status === "published" ? "Published listings are visible to all approved members across cohorts." : status === "archived" ? "Archived listings disappear from member views. Bookmarks are retained if you publish again." : "Drafts are visible only to organizers. Publish when the details are ready."}</p>
    <InlineError message={error} />
    <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><ActionButton appearance="secondary" onPress={onClose} isDisabled={busy}>Cancel</ActionButton><ActionButton type="submit" busy={busy}>{status === "published" ? "Publish opportunity" : status === "archived" ? "Archive opportunity" : "Save draft"}</ActionButton></div>
  </form></OpportunityModal>;
}
