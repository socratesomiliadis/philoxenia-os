"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { LifeBuoy } from "lucide-react";
import { toast } from "@heroui/react";
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
  return <><ActionButton appearance="secondary" onPress={() => setOpen(true)} aria-label="I need help" className="px-3"><LifeBuoy className="size-4" aria-hidden /><span className={compact ? "hidden sm:inline" : undefined}>I need help</span></ActionButton>
    {open ? <OpportunityModal title="I need help" onClose={() => setOpen(false)}><div className="space-y-5"><p className="text-sm leading-6 text-muted">Tell your organizers where you’re stuck. Only you and the organizers can read this check-in. This inbox is not monitored continuously.</p>{available.length > 1 ? <ChoiceField label="Cohort" value={selected._id} options={available.map((c) => ({ value: c._id, label: c.name }))} onChange={setSelectedId} /> : <p className="text-xs text-muted">{selected.name}</p>}{preview ? <p className="text-sm text-muted">Sign in to send a help check-in. Sample check-ins are disabled.</p> : <ConnectedCheckin key={selected._id} cohort={selected} onClose={() => setOpen(false)} />}</div></OpportunityModal> : null}
  </>;
}

function ConnectedCheckin({ cohort, onClose }: { cohort: Cohort; onClose: () => void }) {
  const checkin = useQuery(api.commandCenter.ownCheckin, { cohortId: cohort._id });
  if (checkin === undefined) return <p role="status" className="text-sm text-muted">Loading your check-in…</p>;
  return <CheckinForm cohort={cohort} checkin={checkin} onClose={onClose} />;
}

function CheckinForm({ cohort, checkin: loadedCheckin, onClose }: { cohort: Cohort; checkin: Doc<"helpCheckins"> | null; onClose: () => void }) {
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
  return <form onSubmit={submit} className="space-y-4">{checkin ? <Badge tone={checkin.status === "open" ? "gold" : "green"}>{checkin.status === "open" ? "Awaiting follow-up" : "Previous check-in resolved"}</Badge> : null}<SupportText label="What do you need help with?" value={message} onChange={setMessage} required /><div ref={errorRef} tabIndex={-1} className="rounded-xl outline-none"><InlineError message={error} /></div><div className="flex flex-wrap gap-3"><ActionButton type="submit" busy={busy}>{checkin?.status === "open" ? "Update check-in" : "Send help check-in"}</ActionButton>{checkin?.status === "open" ? <ActionButton appearance="secondary" isDisabled={busy} onPress={() => void closeCheckin()}>I’m all set now</ActionButton> : null}</div></form>;
}
