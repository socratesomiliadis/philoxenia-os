"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, Badge, ChoiceField, InlineError, errorMessage } from "./ui";
import { OpportunityModal } from "./opportunity-parts";
import { SupportText } from "./open-doors-editors";

export function HelpCheckin({ compact = false }: { compact?: boolean }) {
  const { preview, viewer, cohorts } = useWorkspace();
  const available = cohorts.filter((c) => c.status !== "completed" && (preview || viewer?.participantCohortIds.includes(c._id)));
  const [open, setOpen] = useState(false), [selectedId, setSelectedId] = useState("");
  const selected = available.find((c) => c._id === selectedId) ?? available.find((c) => c.status === "active") ?? available[0];
  if (!selected) return null;
  const intro = <><p className="text-sm leading-6 text-muted-foreground">Tell your organizers where you’re stuck. Only you and the organizers can read this check-in. This inbox is not monitored continuously.</p>{available.length > 1 ? <ChoiceField label="Cohort" value={selected._id} options={available.map((c) => ({ value: c._id, label: c.name }))} onChange={setSelectedId} /> : <p className="text-xs text-muted-foreground">{selected.name}</p>}</>;
  return <><ActionButton appearance="secondary" onClick={() => setOpen(true)} aria-label="I need help" className="px-3"><LifeBuoy className="size-4" aria-hidden /><span className={compact ? "hidden sm:inline" : undefined}>I need help</span></ActionButton>
    {open ? preview ? <OpportunityModal title="I need help" onClose={() => setOpen(false)}><div className="space-y-5">{intro}<p className="text-sm text-muted-foreground">Sign in to send a help check-in. Sample check-ins are disabled.</p></div></OpportunityModal> : <ConnectedCheckin key={selected._id} cohort={selected} intro={intro} onClose={() => setOpen(false)} /> : null}
  </>;
}

function ConnectedCheckin({ cohort, onClose, intro }: { cohort: Cohort; onClose: () => void; intro: ReactNode }) {
  const checkin = useQuery(api.commandCenter.ownCheckin, { cohortId: cohort._id });
  if (checkin === undefined) return <OpportunityModal title="I need help" onClose={onClose}><p role="status" className="text-sm text-muted-foreground">Loading your check-in…</p></OpportunityModal>;
  return <CheckinForm cohort={cohort} checkin={checkin} onClose={onClose} intro={intro} />;
}

function CheckinForm({ cohort, checkin: loadedCheckin, onClose, intro }: { cohort: Cohort; checkin: Doc<"helpCheckins"> | null; onClose: () => void; intro: ReactNode }) {
  const formId = useId();
  // Retain the editor's revision and text if an organizer changes the check-in.
  // The mutation then asks the participant to reopen rather than losing a draft.
  const [checkin] = useState(loadedCheckin);
  const save = useMutation(api.commandCenter.checkIn), resolve = useMutation(api.commandCenter.resolveCheckin);
  const [message, setMessage] = useState(checkin?.status === "open" ? checkin.message : ""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await save({ cohortId: cohort._id, message, expectedRevision: checkin?.revision ?? 0 }); toast.success("Help check-in sent", { description: "Your organizers can now see it in the Command Center." }); onClose(); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  async function closeCheckin() {
    if (!checkin) return;
    setBusy(true); setError(null);
    try { await resolve({ checkinId: checkin._id, expectedRevision: checkin.revision }); toast.success("Check-in resolved"); onClose(); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <OpportunityModal title="I need help" busy={busy} onClose={onClose} footer={<div className="space-y-3"><div ref={errorRef} tabIndex={-1} className="rounded-xl outline-none"><InlineError message={error} /></div><div className="flex flex-wrap justify-end gap-3"><ActionButton appearance="secondary" disabled={busy} onClick={onClose}>Cancel</ActionButton>{checkin?.status === "open" ? <ActionButton appearance="secondary" disabled={busy} onClick={() => void closeCheckin()}>I’m all set now</ActionButton> : null}<ActionButton form={formId} type="submit" busy={busy}>{checkin?.status === "open" ? "Update check-in" : "Send help check-in"}</ActionButton></div></div>}><div className="space-y-5">{intro}<form id={formId} onSubmit={submit} className="space-y-4">{checkin ? <Badge tone={checkin.status === "open" ? "gold" : "green"}>{checkin.status === "open" ? "Awaiting follow-up" : "Previous check-in resolved"}</Badge> : null}<SupportText label="What do you need help with?" value={message} onChange={setMessage} required /></form></div></OpportunityModal>;
}
