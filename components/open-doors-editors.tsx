"use client";

import { useState, type FormEvent } from "react";
import { Label, TextArea, TextField } from "@heroui/react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { offerSchema, requestSchema, supportKinds, supportLabels, type OfferInput } from "@/lib/open-doors";
import { ActionButton, Field, InlineError, errorMessage } from "./ui";
import { OpportunityModal, SelectField } from "./opportunity-parts";
import type { Cohort } from "./workspace-context";
import type { DoorOffer } from "./open-doors-types";

export function SupportText({ label, value, onChange, maxLength = 2000, required = false }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; required?: boolean }) {
  return <TextField className="min-w-0 gap-2" isRequired={required}><Label className="text-sm font-medium text-foreground">{label}</Label><TextArea value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={maxLength} rows={3} className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6" /></TextField>;
}

export function OfferEditor({ offer, onClose, onSave }: { offer?: Doc<"alumniOffers">; onClose: () => void; onSave: (input: OfferInput) => Promise<void> }) {
  const [input, setInput] = useState<OfferInput>(offer ?? { kind: "mentorship", title: "", description: "", availability: "", capacity: 2, connection: "", published: true });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  function update<K extends keyof OfferInput>(key: K, value: OfferInput[K]) { setInput((input) => ({ ...input, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const parsed = offerSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); try { await onSave(parsed.data); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <OpportunityModal title={offer ? "Edit your support offer" : "Offer your support"} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5">
    <p className="text-sm leading-6 text-muted">Offer something you can personally provide. You decide each request directly.</p>
    <SelectField label="Support type" value={input.kind} onChange={(event) => update("kind", event.target.value as OfferInput["kind"])}>{supportKinds.map((kind) => <option value={kind} key={kind}>{supportLabels[kind]}</option>)}</SelectField>
    <Field label="Offer title" value={input.title} onChange={(event) => update("title", event.target.value)} required minLength={3} maxLength={120} placeholder="Feedback on your first pitch" />
    <SupportText label="What you can provide" value={input.description} onChange={(value) => update("description", value)} required />
    {input.kind === "introduction" ? <SupportText label="Your actual connection and introduction path" value={input.connection} onChange={(value) => update("connection", value)} maxLength={1000} required /> : null}
    <SupportText label="Availability and how to agree a time" value={input.availability} onChange={(value) => update("availability", value)} maxLength={500} required />
    <Field label="Concurrent support places" type="number" min={1} max={50} required value={String(input.capacity)} onChange={(event) => update("capacity", Number(event.target.value))} />
    <p className="text-xs leading-5 text-muted">Alternatives and agreed requests reserve a place until support is completed or withdrawn.</p>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={input.published} onChange={(event) => update("published", event.target.checked)} className="size-4 accent-forest" />Publish for the community</label>
    <InlineError message={error} /><div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4"><ActionButton appearance="secondary" onPress={onClose} isDisabled={busy}>Cancel</ActionButton><ActionButton type="submit" busy={busy}>{input.published ? "Publish offer" : "Save private draft"}</ActionButton></div>
  </form></OpportunityModal>;
}

export function SupportRequestEditor({ offer, cohorts, onSave, onClose }: { offer: DoorOffer; cohorts: Cohort[]; onSave: (cohortId: Id<"cohorts">, goal: string, fit: string) => Promise<void>; onClose: () => void }) {
  const [cohortId, setCohortId] = useState<string>(cohorts.find((cohort) => cohort.status === "active")?._id ?? cohorts[0]?._id ?? "");
  const [goal, setGoal] = useState(""), [fit, setFit] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const parsed = requestSchema.safeParse({ goal, fit });
    if (!parsed.success || !cohortId) { setError(parsed.success ? "Choose your cohort." : parsed.error.issues[0].message); return; }
    setBusy(true); try { await onSave(cohortId as Id<"cohorts">, parsed.data.goal, parsed.data.fit); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <OpportunityModal title={`Request ${offer.title}`} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5"><p className="text-sm leading-6 text-muted">{offer.ownerName} will review your request. Keep it focused and explain the useful next step.</p><SelectField label="Your cohort" required value={cohortId} onChange={(event) => setCohortId(event.target.value)}>{cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.name}</option>)}</SelectField><SupportText label="What do you want to achieve?" value={goal} onChange={setGoal} maxLength={1000} required /><SupportText label="Why is this support a good fit?" value={fit} onChange={setFit} maxLength={1000} required /><InlineError message={error} /><div className="flex flex-wrap justify-end gap-3"><ActionButton appearance="secondary" isDisabled={busy} onPress={onClose}>Cancel</ActionButton><ActionButton type="submit" busy={busy}>Send request</ActionButton></div></form></OpportunityModal>;
}
