"use client";

import { useState, type FormEvent } from "react";
import { Checkbox, Label, TextArea, TextField } from "@heroui/react";
import { industries } from "@/lib/mission";
import { categoryLabels, missionCategories, opportunitySchema, parseSfDateTime, sfDateTimeInput, type MissionCategory, type Opportunity, type OpportunityInput } from "@/lib/opportunities";
import { ActionButton, ChoiceField, Field, InlineError, errorMessage } from "./ui";
import { OpportunityModal } from "./opportunity-parts";

function LongField({ label, value, onChange, maxLength, minLength, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; minLength?: number; rows?: number }) {
  return <TextField className="gap-2" isRequired><Label className="text-sm font-medium text-foreground">{label}</Label><TextArea required value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} minLength={minLength} rows={rows} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6 shadow-control" /></TextField>;
}
function shiftDate(date: string, days: number) { return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10); }

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
  const [allDay, setAllDay] = useState(!!entry?.eventDate);
  const [eventDate, setEventDate] = useState(entry?.eventDate ?? "");
  const [lastDate, setLastDate] = useState(entry?.eventEndDate ? shiftDate(entry.eventEndDate, -1) : entry?.eventDate ?? "");
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
        ...(kind === "event" ? { ...(allDay ? { eventDate: eventDate || undefined, eventEndDate: lastDate ? shiftDate(lastDate, 1) : undefined } : { startAt: start ? parseSfDateTime(start) : undefined, endAt: end ? parseSfDateTime(end) : undefined }), cost, costNote: costNote.trim() || undefined } : {}),
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
    {entry?.primarySourceId ? <p className="rounded-xl bg-soft p-4 text-sm leading-6 text-muted">Fields you change here are protected from future imports. Use Source details to review the latest provider data or restore imported fields.</p> : null}
    <div className="grid gap-4 @min-[400px]/opportunity-dialog:grid-cols-2"><ChoiceField label="Type" value={kind} options={[{ value: "event", label: "Event" }, { value: "startup", label: "Startup" }, { value: "founder", label: "Founder" }, { value: "alumni", label: "Alumni offer" }]} onChange={(value) => { setKind(value as OpportunityInput["kind"]); setConfirmSupport(false); }} /><ChoiceField label="Publication status" value={status} options={[{ value: "draft", label: "Draft · organizers only" }, { value: "published", label: "Published · all members" }, { value: "archived", label: "Archived · organizers only" }]} onChange={(value) => setStatus(value as OpportunityInput["status"])} /></div>
    <Field label="Title" required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Founders & product feedback" />
    <LongField label="Short summary" value={summary} onChange={setSummary} minLength={10} maxLength={240} rows={2} />
    <LongField label="Details and what to expect" value={description} onChange={setDescription} minLength={20} maxLength={5000} rows={5} />
    <fieldset className="space-y-3"><legend className="text-sm font-medium text-foreground">Interests (choose up to 8)</legend><div className="grid gap-2 @min-[400px]/opportunity-dialog:grid-cols-2">{allInterests.map((interest) => <Checkbox key={interest} isSelected={interests.includes(interest)} isDisabled={!interests.includes(interest) && interests.length >= 8} onChange={(selected) => setInterests((current) => selected ? [...current, interest] : current.filter((item) => item !== interest))} className="rounded-lg border border-line p-2.5"><Checkbox.Content className="items-start gap-2"><Checkbox.Control className="mt-0.5 shrink-0"><Checkbox.Indicator /></Checkbox.Control><Label className="text-sm leading-5 text-foreground">{interest}</Label></Checkbox.Content></Checkbox>)}</div></fieldset>
    <fieldset className="space-y-3"><legend className="text-sm font-medium text-foreground">Useful for</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{missionCategories.map((category) => <Checkbox key={category} isSelected={categories.includes(category)} onChange={(selected) => setCategories((current) => selected ? [...current, category] : current.filter((item) => item !== category))}><Checkbox.Content className="gap-2"><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Label className="text-sm text-foreground">{categoryLabels[category]}</Label></Checkbox.Content></Checkbox>)}</div></fieldset>
    <div className="grid gap-4 @min-[400px]/opportunity-dialog:grid-cols-2"><ChoiceField label="Area" value={area} options={[{ value: "sf", label: "San Francisco" }, { value: "bay-area", label: "Wider Bay Area" }, { value: "online", label: "Online" }]} onChange={(value) => setArea(value as OpportunityInput["area"])} /><Field label="Location / venue" required minLength={2} maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} /></div>
    {kind === "event" ? <fieldset className="space-y-4 rounded-2xl border border-line p-4"><legend className="px-1 text-sm font-medium text-foreground">Event details</legend><p className="text-xs leading-5 text-muted">Enter dates and times in San Francisco time (America/Los_Angeles). If the venue is unannounced, say so in the location.</p><ChoiceField label="Event timing" value={allDay ? "all-day" : "timed"} options={[{ value: "timed", label: "Specific times" }, { value: "all-day", label: "All-day dates" }]} onChange={(value) => setAllDay(value === "all-day")} />{allDay ? <><Field label="First day" type="date" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} /><Field label="Last day (optional)" type="date" value={lastDate} onChange={(event) => setLastDate(event.target.value)} /><p className="text-xs leading-5 text-muted">All-day dates do not confirm an event’s meeting time. Check registration before scheduling.</p></> : <><Field label="Starts (SF time)" type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} /><Field label="Ends (SF time, optional)" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></>}<ChoiceField label="Cost" value={cost} options={[{ value: "unknown", label: "Price not confirmed" }, { value: "free", label: "Free" }, { value: "paid", label: "Paid" }]} onChange={(value) => setCost(value as typeof cost)} /><Field label="Price or registration notes (optional)" maxLength={160} value={costNote} onChange={(event) => setCostNote(event.target.value)} placeholder="From $20 · approval required" /><p className="text-xs leading-5 text-muted">Use the original event’s registration page as the source link below.</p></fieldset> : null}
    {kind === "alumni" ? <fieldset className="space-y-4 rounded-2xl border border-line p-4"><legend className="px-1 text-sm font-medium text-foreground">Confirmed support path</legend><p className="text-xs leading-5 text-muted">Only list support the alumnus agreed to provide. For introductions, describe a connection they can actually facilitate.</p><Field label="Alumnus offering support" required minLength={2} maxLength={100} value={offeredBy} onChange={(event) => setOfferedBy(event.target.value)} /><LongField label="Support and how to request it" value={pathway} onChange={setPathway} minLength={10} maxLength={1000} /><Field label="Request / booking URL" type="url" required value={supportUrl} onChange={(event) => setSupportUrl(event.target.value)} maxLength={2000} placeholder="https://cal.com/example/product-review" /><Field label="Availability and capacity" required minLength={5} maxLength={240} value={availability} onChange={(event) => setAvailability(event.target.value)} placeholder="Two 30-minute reviews during the November cohort" /><Checkbox isSelected={confirmSupport} onChange={setConfirmSupport} isRequired={status === "published"}><Checkbox.Content className="items-start gap-2.5"><Checkbox.Control className="mt-1 shrink-0"><Checkbox.Indicator /></Checkbox.Control><Label className="text-sm leading-6 text-foreground">I confirmed this offer, availability, and request path with the alumnus.</Label></Checkbox.Content></Checkbox></fieldset> : kind !== "event" ? <p className="rounded-xl bg-soft p-4 text-xs leading-6 text-muted">Startup and founder entries are public directory listings. They do not promise an introduction, meeting, or office visit.</p> : null}
    <Field label="Original source name" required minLength={2} maxLength={100} value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Luma · event organizer" />
    <Field label="Original source URL" type="url" required maxLength={2000} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://lu.ma/example" />
    <Checkbox isSelected={organizerPick} onChange={setOrganizerPick}><Checkbox.Content className="min-h-11 gap-2.5"><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Label className="text-sm text-foreground">Recommend as an organizer pick</Label></Checkbox.Content></Checkbox>
    <p className="text-xs leading-5 text-muted">{status === "published" ? "Published listings are visible to all approved members across cohorts." : status === "archived" ? "Archived listings disappear from member views. Bookmarks are retained if you publish again." : "Drafts are visible only to organizers. Publish when the details are ready."}</p>
    <InlineError message={error} />
    <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><ActionButton appearance="secondary" onPress={onClose} isDisabled={busy}>Cancel</ActionButton><ActionButton type="submit" busy={busy}>{status === "published" ? "Publish opportunity" : status === "archived" ? "Archive opportunity" : "Save draft"}</ActionButton></div>
  </form></OpportunityModal>;
}
