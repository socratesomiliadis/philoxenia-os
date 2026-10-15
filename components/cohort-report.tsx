"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Download, RefreshCw, LifeBuoy } from "lucide-react";
import { toast } from "@heroui/react";
import { api } from "@/convex/_generated/api";
import { cohortCsv, exportKinds, type CohortReportData } from "@/lib/cohort-export";
import { eventTimeLabel } from "@/lib/opportunities";
import { outcomeLabels } from "@/lib/sprint";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, Badge, Field, InlineError, Panel, errorMessage } from "./ui";
import { OpportunityModal } from "./opportunity-parts";
import { SupportText } from "./open-doors-editors";

type Person = CohortReportData["participants"][number];
function download(report: CohortReportData, kind: typeof exportKinds[number]) {
  const url = URL.createObjectURL(new Blob([cohortCsv(report, kind)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `philoxenia-${report.cohort.startDate}-${kind}.csv`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CohortReport({ cohort }: { cohort: Cohort }) {
  const { preview } = useWorkspace();
  return preview ? <Panel className="space-y-4 p-5 sm:p-6"><h2 className="text-xl font-medium tracking-tight">Cohort support & results</h2><p className="text-sm leading-6 text-muted">Review help check-ins, incomplete onboarding, requests awaiting a response for 48 hours, and overdue goals. Every flag explains its reason.</p><div className="flex flex-wrap gap-2"><Badge>Planned meetings</Badge><Badge>Participant-marked completion</Badge><Badge>Self-reported outcomes</Badge></div><p className="text-xs text-muted">Sign in as an organizer to see participant details, save private notes, and export cohort CSVs.</p></Panel> : <ConnectedReport key={cohort._id} cohort={cohort} />;
}

function ConnectedReport({ cohort }: { cohort: Cohort }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const report = useQuery(api.commandCenter.cohortSummary, { cohortId: cohort._id, refreshKey });
  const [search, setSearch] = useState(""), [attentionOnly, setAttentionOnly] = useState(true), [selected, setSelected] = useState<Person | null>(null);
  if (!report) return <Panel className="p-6"><p role="status" className="text-sm text-muted">Loading cohort support & results…</p></Panel>;
  const participants = report.participants.filter((p) => (!attentionOnly || p.flags.length > 0) && `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()));
  return <Panel className="space-y-5 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-medium tracking-tight">Cohort support & results</h2><p className="mt-2 text-xs leading-5 text-muted">As of {eventTimeLabel(report.asOf)} · San Francisco time. Refresh to update time-based flags.</p></div><ActionButton appearance="secondary" onPress={() => setRefreshKey((n) => n + 1)}><RefreshCw className="size-4" aria-hidden />Refresh status</ActionButton></div>
    <dl className="grid grid-cols-2 gap-4 @min-[640px]:grid-cols-4">{[
      ["Active participants", report.summary.active], ["Need attention", report.summary.needingAttention], ["Open help check-ins", report.summary.openCheckins], ["Incomplete onboarding", report.summary.onboardingIncomplete],
      ["Planned meetings", report.summary.plannedMeetings], ["Marked completed", report.summary.completedActivities], ["Self-reported outcomes", report.summary.reportedOutcomes], ["Pending support requests", report.summary.pendingRequests],
    ].map(([label, count]) => <div key={label} className="min-w-0 rounded-xl bg-soft p-3"><dt className="text-xs leading-5 text-muted">{label}</dt><dd className="mt-1 text-2xl font-medium tabular-nums">{count}</dd></div>)}</dl>
    <p className="text-xs leading-5 text-muted">Activity completion is marked by the participant. Outcomes are self-reported records, not verified results. Shared activities count once per active participant. {report.summary.pendingInvitations} pending invitation(s).</p>
    <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1 basis-48"><Field label="Find a participant" type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></div><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} className="size-4 accent-forest" />Needs attention only</label></div>
    <div className="space-y-3">{participants.map((p) => <article key={p.profileId} className="space-y-3 rounded-xl border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-base font-medium wrap-anywhere">{p.name}</h3><p className="text-xs leading-5 text-muted wrap-anywhere">{p.email}</p></div><div className="flex flex-wrap gap-2">{p.suspended ? <Badge>Suspended</Badge> : p.membershipStatus === "revoked" ? <Badge>Access revoked</Badge> : p.flags.length ? <Badge tone="gold">Needs attention</Badge> : <Badge tone="green">No current flags</Badge>}<ActionButton appearance="secondary" onPress={() => setSelected(p)}>Review participant</ActionButton></div></div>{p.flags.length ? <ul className="space-y-1 text-sm leading-6 text-muted">{p.flags.map((flag, i) => <li key={i} className="flex gap-2"><LifeBuoy className="mt-1 size-4 shrink-0 text-forest" aria-hidden /><span className="wrap-anywhere">{flag.reason}</span></li>)}</ul> : null}</article>)}{!participants.length ? <p className="py-3 text-sm leading-6 text-muted">{report.participants.length ? "No participants match these filters. Clear the search or show everyone to review the cohort." : "No participants have joined yet. Invite a Hustler to get started."}</p> : null}</div>
    <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-medium">Export cohort CSVs</summary><div className="mt-4 space-y-3"><p className="text-xs leading-5 text-muted">Exports include the entire selected cohort, including revoked and suspended participants. Private organizer notes and help messages stay in the app. Share personal data only with the people running this cohort.</p><div className="flex flex-wrap gap-2">{exportKinds.map((kind) => <ActionButton key={kind} appearance="secondary" onPress={() => download(report, kind)}><Download className="size-4" aria-hidden />{kind.charAt(0).toUpperCase() + kind.slice(1)} CSV</ActionButton>)}</div></div></details>
    {selected ? <ParticipantReview person={selected} cohort={cohort} onClose={() => setSelected(null)} /> : null}
  </Panel>;
}

function ParticipantReview({ person, cohort, onClose }: { person: Person; cohort: Cohort; onClose: () => void }) {
  const save = useMutation(api.commandCenter.saveNote), resolve = useMutation(api.commandCenter.resolveCheckin);
  const [note, setNote] = useState(person.note?.note ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function saveNote(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await save({ cohortId: cohort._id, profileId: person.profileId, note, expectedRevision: person.note?.revision ?? 0 }); toast.success("Private organizer note saved"); onClose(); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  async function resolveHelp() {
    if (!person.checkin) return;
    setBusy(true); setError(null);
    try { await resolve({ checkinId: person.checkin._id, expectedRevision: person.checkin.revision }); toast.success("Check-in resolved"); onClose(); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <OpportunityModal title={`${person.name} · Cohort review`} onClose={() => { if (!busy) onClose(); }}><div className="space-y-6">
    <p className="text-xs leading-5 text-muted">{person.startDate} – {person.endDate} · San Francisco dates</p>
    {person.checkin ? <section className="space-y-3 rounded-xl bg-soft p-4"><h3 className="font-medium">Help check-in · {person.checkin.status}</h3><p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere">{person.checkin.message}</p>{person.checkin.status === "open" ? <ActionButton appearance="secondary" isDisabled={busy} onPress={() => void resolveHelp()}>Mark check-in resolved</ActionButton> : null}</section> : null}
    <section className="space-y-3"><h3 className="font-medium">Confirmed mission</h3>{person.goals.length ? person.goals.map((g, i) => <div key={i} className="rounded-xl border border-line p-3"><p className="text-sm font-medium wrap-anywhere">{g.title}</p><p className="mt-1 text-xs leading-5 text-muted">{person.totals[i]}/{g.target} {g.metric} · Due {g.deadline}</p></div>) : <p className="text-sm text-muted">Onboarding is incomplete; no confirmed mission.</p>}</section>
    <section className="space-y-3"><h3 className="font-medium">Scheduled meetings</h3>{person.entries.filter((a) => a.kind === "meeting").map((a) => <div key={a.id} className="space-y-1 rounded-xl border border-line p-3"><p className="text-sm font-medium wrap-anywhere">{a.title}</p><p className="text-xs leading-5 text-muted">{a.startAt === undefined ? "Time not scheduled" : eventTimeLabel(a.startAt)} · {a.status === "completed" ? "Marked completed by participant" : a.status === "skipped" ? "Skipped by participant" : "Planned"}</p></div>)}{!person.entries.some((a) => a.kind === "meeting") ? <p className="text-sm text-muted">No meetings scheduled.</p> : null}</section>
    <section className="space-y-3"><h3 className="font-medium">Self-reported outcomes</h3>{person.outcomes.map((o) => <div key={o._id} className="space-y-1 rounded-xl border border-line p-3"><p className="text-sm font-medium wrap-anywhere">{o.title}</p><p className="text-xs text-muted">{outcomeLabels[o.type]} · {o.date} · Quantity {o.quantity} · Self-reported</p>{o.notes ? <p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-muted">{o.notes}</p> : null}</div>)}{!person.outcomes.length ? <p className="text-sm text-muted">No outcomes reported.</p> : null}</section>
    <form onSubmit={saveNote} className="space-y-3 border-t border-line pt-5"><SupportText label="Private organizer follow-up note" value={note} onChange={setNote} maxLength={3000} /><p className="text-xs leading-5 text-muted">Only organizers can read this note. It is excluded from CSV exports.{person.note ? ` Last saved by ${person.note.organizerName}.` : ""}</p><ActionButton type="submit" busy={busy}>Save private note</ActionButton></form><div ref={errorRef} tabIndex={-1} className="rounded-xl outline-none"><InlineError message={error} /></div>
  </div></OpportunityModal>;
}

export function PilotOperations() {
  const { preview } = useWorkspace();
  return preview ? null : <ConnectedOperations />;
}

function ConnectedOperations() {
  const operations = useQuery(api.commandCenter.operations);
  if (!operations) return null;
  return <Panel className="space-y-4 p-5 sm:p-6"><h2 className="text-xl font-medium tracking-tight">Pilot operations</h2><p className="text-xs leading-5 text-muted">Configuration in this backend environment. Credentials being present does not verify provider setup or delivery.</p><ul className="space-y-2 text-sm leading-6 text-muted"><li>Google OAuth credentials: {operations.oauthConfigured ? "Configured" : "Missing"}</li><li>Transactional email credentials: {operations.emailConfigured ? "Configured; verify domain and delivery" : "Missing; in-app notifications remain available"}</li><li>App origin: {operations.httpsSite ? "HTTPS configured" : "Local or missing; set production SITE_URL before release"}</li><li>Provisioned organizers: {operations.organizerCount} / 2 required for pilot handover</li><li>Latest 50 email deliveries: {operations.failedEmails} failed, {operations.disabledEmails} disabled</li><li>Latest 20 imports: {operations.failedImports} failed, {operations.stuckImports} past the 20-minute run limit</li></ul><p className="text-xs leading-5 text-muted">Review import details in Manage imports and delivery errors in Coordinate Open Doors. Runtime errors appear in the Convex and Vercel deployment logs.</p></Panel>;
}
