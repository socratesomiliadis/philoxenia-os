"use client";

import { useId, useState, type FormEvent } from "react";
import { TextareaField } from "./ui";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { offerSchema, requestSchema, supportKinds, supportLabels, type OfferInput } from "@/lib/open-doors";
import { CheckboxField, Field, errorMessage } from "./ui";
import { OpportunityModal, SelectField } from "./opportunity-parts";
import type { Cohort } from "./workspace-context";
import type { DoorOffer } from "./open-doors-types";
import { DialogFormActions } from "./workspace-dialog";

export function SupportText({ label, value, onChange, maxLength = 2000, required = false }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; required?: boolean }) {
  return <TextareaField label={label} value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={maxLength} rows={3} />;
}

export function OfferEditor({ offer, onClose, onSave }: { offer?: Doc<"alumniOffers">; onClose: () => void; onSave: (input: OfferInput) => Promise<void> }) {
  const formId = useId();
  const [input, setInput] = useState<OfferInput>(offer ?? { kind: "mentorship", title: "", description: "", availability: "", capacity: 2, connection: "", published: true });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  function update<K extends keyof OfferInput>(key: K, value: OfferInput[K]) { setInput((input) => ({ ...input, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const parsed = offerSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); try { await onSave(parsed.data); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <OpportunityModal title={offer ? "Edit your support offer" : "Offer your support"} busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label={input.published ? "Publish offer" : "Save private draft"} />}><form id={formId} onSubmit={submit} className="space-y-5">
    <p className="text-sm leading-6 text-muted-foreground">Offer something you can personally provide. You decide each request directly.</p>
    <SelectField label="Support type" value={input.kind} onChange={(event) => update("kind", event.target.value as OfferInput["kind"])}>{supportKinds.map((kind) => <option value={kind} key={kind}>{supportLabels[kind]}</option>)}</SelectField>
    <Field label="Offer title" value={input.title} onChange={(event) => update("title", event.target.value)} required minLength={3} maxLength={120} placeholder="Feedback on your first pitch" />
    <SupportText label="What you can provide" value={input.description} onChange={(value) => update("description", value)} required />
    {input.kind === "introduction" ? <SupportText label="Your actual connection and introduction path" value={input.connection} onChange={(value) => update("connection", value)} maxLength={1000} required /> : null}
    <SupportText label="Availability and how to agree a time" value={input.availability} onChange={(value) => update("availability", value)} maxLength={500} required />
    <Field label="Concurrent support places" type="number" min={1} max={50} required value={String(input.capacity)} onChange={(event) => update("capacity", Number(event.target.value))} />
    <p className="text-xs leading-5 text-muted-foreground">Alternatives and agreed requests reserve a place until support is completed or withdrawn.</p>
    <CheckboxField checked={input.published} onCheckedChange={(checked) => update("published", checked)} contentClassName="min-h-11 gap-3">Publish for the community</CheckboxField>
  </form></OpportunityModal>;
}

export function SupportRequestEditor({ offer, cohorts, onSave, onClose }: { offer: DoorOffer; cohorts: Cohort[]; onSave: (cohortId: Id<"cohorts">, goal: string, fit: string) => Promise<void>; onClose: () => void }) {
  const formId = useId();
  const [cohortId, setCohortId] = useState<string>(cohorts.find((cohort) => cohort.status === "active")?._id ?? cohorts[0]?._id ?? "");
  const [goal, setGoal] = useState(""), [fit, setFit] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const parsed = requestSchema.safeParse({ goal, fit });
    if (!parsed.success || !cohortId) { setError(parsed.success ? "Choose your cohort." : parsed.error.issues[0].message); return; }
    setBusy(true); try { await onSave(cohortId as Id<"cohorts">, parsed.data.goal, parsed.data.fit); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <OpportunityModal title={`Request ${offer.title}`} busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label="Send request" />}><form id={formId} onSubmit={submit} className="space-y-6"><p className="text-sm leading-6 text-muted-foreground">{offer.ownerName} will review your request. Keep it focused and explain the useful next step.</p><SelectField label="Your cohort" required value={cohortId} onChange={(event) => setCohortId(event.target.value)}>{cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.name}</option>)}</SelectField><div className="grid gap-6 @min-[600px]/opportunity-dialog:grid-cols-2"><SupportText label="What do you want to achieve?" value={goal} onChange={setGoal} maxLength={1000} required /><SupportText label="Why is this support a good fit?" value={fit} onChange={setFit} maxLength={1000} required /></div></form></OpportunityModal>;
}
