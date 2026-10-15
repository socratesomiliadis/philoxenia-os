"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Download, RefreshCw, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { cohortCsv, exportKinds, type CohortReportData } from "@/lib/cohort-export";
import { eventTimeLabel } from "@/lib/opportunities";
import { outcomeLabels } from "@/lib/sprint";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, Badge, CheckboxField, Panel, SearchField, errorMessage } from "./ui";
import { OpportunityModal } from "./opportunity-parts";
import { SupportText } from "./open-doors-editors";
import { DialogFormActions } from "./workspace-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

type Person = CohortReportData["participants"][number];
function download(report: CohortReportData, kind: typeof exportKinds[number]) {
  const url = URL.createObjectURL(new Blob([cohortCsv(report, kind)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `philoxenia-${report.cohort.startDate}-${kind}.csv`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CohortReport({ cohort, onShowParticipants }: { cohort: Cohort; onShowParticipants?: () => void }) {
  const { preview } = useWorkspace();
  return preview ? <Panel className="space-y-3 p-5 sm:p-6"><h2 className="text-lg font-medium">Follow-ups</h2><p className="max-w-lg text-sm leading-6 text-muted-foreground">Sign in to review participant check-ins, overdue goals, and private follow-up notes.</p></Panel> : <ConnectedReport key={cohort._id} cohort={cohort} onShowParticipants={onShowParticipants} />;
}

function ConnectedReport({ cohort, onShowParticipants }: { cohort: Cohort; onShowParticipants?: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const report = useQuery(api.commandCenter.cohortSummary, { cohortId: cohort._id, refreshKey });
  const [search, setSearch] = useState(""), [attentionOnly, setAttentionOnly] = useState(true), [selected, setSelected] = useState<Person | null>(null);
  if (!report) return <Panel className="p-6"><p role="status" className="text-sm text-muted-foreground">Loading cohort overview...</p></Panel>;
  const participants = report.participants.filter((p) => (!attentionOnly || p.flags.length > 0) && `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5">
    <dl aria-label="Cohort follow-up summary" className="hidden grid-cols-4 gap-3 @min-[640px]:grid">{[
      ["Need attention", report.summary.needingAttention], ["Open check-ins", report.summary.openCheckins], ["Incomplete missions", report.summary.onboardingIncomplete], ["Pending support requests", report.summary.pendingRequests],
    ].map(([label, count]) => <div key={label} className="min-w-0 rounded-xl bg-soft p-4"><dt className="text-xs leading-5 text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-medium tabular-nums text-forest">{count}</dd></div>)}</dl>
    <Panel className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="text-lg font-medium tracking-tight">Follow-ups</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Updated {eventTimeLabel(report.asOf)}</p></div><div className="flex flex-wrap gap-2"><ActionButton appearance="secondary" aria-label="Refresh status" title="Refresh status" onClick={() => setRefreshKey((n) => n + 1)} className="size-11 px-0 @min-[640px]:w-auto @min-[640px]:px-4"><RefreshCw className="size-4" aria-hidden /><span className="hidden @min-[640px]:inline">Refresh</span></ActionButton><DropdownMenu><DropdownMenuTrigger render={<ActionButton appearance="secondary" aria-label="Export cohort CSVs" title="Export cohort CSVs" className="size-11 px-0 @min-[640px]:w-auto @min-[640px]:px-4" />}><Download className="size-4" aria-hidden /><span className="hidden @min-[640px]:inline">Export</span></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-32px)] p-2"><p className="px-2 py-2 text-xs leading-5 text-muted-foreground">Whole cohort, including revoked and suspended accounts. Private notes and help messages are excluded.</p>{exportKinds.map((kind) => <DropdownMenuItem key={kind} onClick={() => download(report, kind)}>{kind.charAt(0).toUpperCase() + kind.slice(1)} CSV</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div></div>
      <div className="flex flex-wrap items-center gap-3"><SearchField aria-label="Find a participant" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} containerClassName="flex-1 basis-48" /><CheckboxField checked={attentionOnly} onCheckedChange={(checked) => setAttentionOnly(Boolean(checked))}>Needs attention only</CheckboxField></div>
      <div className="space-y-3">{participants.map((p) => <article key={p.profileId} className="space-y-3 rounded-xl surface-inset p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-base font-medium wrap-anywhere">{p.name}</h3><p className="text-xs leading-5 text-muted-foreground wrap-anywhere">{p.email}</p></div><div className="flex flex-wrap gap-2">{p.suspended ? <Badge>Suspended</Badge> : p.membershipStatus === "revoked" ? <Badge>Access revoked</Badge> : p.flags.length ? <Badge tone="gold">Needs attention</Badge> : null}<ActionButton appearance="secondary" onClick={() => setSelected(p)}>Review participant</ActionButton></div></div>{p.flags.length ? <ul className="space-y-1 text-sm leading-6 text-muted-foreground">{p.flags.map((flag, i) => <li key={i} className="flex gap-2"><LifeBuoy className="mt-1 size-4 shrink-0 text-forest" aria-hidden /><span className="wrap-anywhere">{flag.reason}</span></li>)}</ul> : null}</article>)}{!participants.length ? <div className="py-6 text-center"><h3 className="text-base font-medium">{!report.participants.length ? "No participants yet" : attentionOnly && !search ? "No follow-ups needed" : "No matching participants"}</h3>{!report.participants.length ? <ActionButton appearance="secondary" className="mt-4" onClick={onShowParticipants}>Manage participants</ActionButton> : <ActionButton appearance="secondary" className="mt-4" onClick={() => { setSearch(""); setAttentionOnly(false); }}>Show everyone</ActionButton>}</div> : null}</div>
    </Panel>
    <Accordion><AccordionItem value="results" className="rounded-2xl surface-card px-5 sm:px-6"><AccordionTrigger className="min-h-14 items-center text-start transition-colors">Cohort totals</AccordionTrigger><AccordionContent className="pb-5"><dl className="grid grid-cols-2 gap-4 @min-[760px]:grid-cols-4">{[["Need attention", report.summary.needingAttention], ["Open check-ins", report.summary.openCheckins], ["Incomplete missions", report.summary.onboardingIncomplete], ["Pending support requests", report.summary.pendingRequests]].map(([label, count]) => <div key={label} className="@min-[640px]:hidden"><dt className="text-xs leading-5 text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-medium tabular-nums">{count}</dd></div>)}{[["Active participants", report.summary.active], ["Planned meetings", report.summary.plannedMeetings], ["Marked completed", report.summary.completedActivities], ["Self-reported outcomes", report.summary.reportedOutcomes]].map(([label, count]) => <div key={label}><dt className="text-xs leading-5 text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-medium tabular-nums">{count}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-muted-foreground">Completion is marked by participants. Outcomes are self-reported. Shared activities count once per active participant.</p></AccordionContent></AccordionItem></Accordion>
    {selected ? <ParticipantReview person={selected} cohort={cohort} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function ParticipantReview({ person, cohort, onClose }: { person: Person; cohort: Cohort; onClose: () => void }) {
  const formId = useId();
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
  return <OpportunityModal title={`${person.name} · Cohort review`} busy={busy} onClose={onClose} footer={<div ref={errorRef} tabIndex={-1} className="rounded-xl outline-none"><DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label="Save private note" /></div>}><div className="space-y-6">
    <p className="text-xs leading-5 text-muted-foreground">{person.startDate} – {person.endDate} · San Francisco dates</p>
    {person.checkin ? <section className="space-y-3 rounded-xl bg-soft p-4"><h3 className="font-medium">Help check-in · {person.checkin.status}</h3><p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere">{person.checkin.message}</p>{person.checkin.status === "open" ? <ActionButton appearance="secondary" disabled={busy} onClick={() => void resolveHelp()}>Mark check-in resolved</ActionButton> : null}</section> : null}
    <section className="space-y-3"><h3 className="font-medium">Confirmed mission</h3>{person.goals.length ? person.goals.map((g, i) => <div key={i} className="rounded-xl surface-inset p-3"><p className="text-sm font-medium wrap-anywhere">{g.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{person.totals[i]}/{g.target} {g.metric} · Due {g.deadline}</p></div>) : <p className="text-sm text-muted-foreground">Onboarding is incomplete; no confirmed mission.</p>}</section>
    <section className="space-y-3"><h3 className="font-medium">Scheduled meetings</h3>{person.entries.filter((a) => a.kind === "meeting").map((a) => <div key={a.id} className="space-y-1 rounded-xl surface-inset p-3"><p className="text-sm font-medium wrap-anywhere">{a.title}</p><p className="text-xs leading-5 text-muted-foreground">{a.startAt === undefined ? "Time not scheduled" : eventTimeLabel(a.startAt)} · {a.status === "completed" ? "Marked completed by participant" : a.status === "skipped" ? "Skipped by participant" : "Planned"}</p></div>)}{!person.entries.some((a) => a.kind === "meeting") ? <p className="text-sm text-muted-foreground">No meetings scheduled.</p> : null}</section>
    <section className="space-y-3"><h3 className="font-medium">Self-reported outcomes</h3>{person.outcomes.map((o) => <div key={o._id} className="space-y-1 rounded-xl surface-inset p-3"><p className="text-sm font-medium wrap-anywhere">{o.title}</p><p className="text-xs text-muted-foreground">{outcomeLabels[o.type]} · {o.date} · Quantity {o.quantity} · Self-reported</p>{o.notes ? <p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{o.notes}</p> : null}</div>)}{!person.outcomes.length ? <p className="text-sm text-muted-foreground">No outcomes reported.</p> : null}</section>
    <form id={formId} onSubmit={saveNote} className="space-y-3 pt-5"><SupportText label="Private organizer follow-up note" value={note} onChange={setNote} maxLength={3000} /><p className="text-xs leading-5 text-muted-foreground">Only organizers can read this note. It is excluded from CSV exports.{person.note ? ` Last saved by ${person.note.organizerName}.` : ""}</p></form>
  </div></OpportunityModal>;
}

export function PilotOperations() {
  const { preview } = useWorkspace();
  return preview ? null : <ConnectedOperations />;
}

function ConnectedOperations() {
  const operations = useQuery(api.commandCenter.operations);
  if (!operations) return null;
  return <Panel className="space-y-4 p-5 sm:p-6"><h2 className="text-xl font-medium tracking-tight">System status</h2><p className="text-xs leading-5 text-muted-foreground">Configuration in this backend environment. Credentials being present does not verify provider setup or delivery.</p><ul className="space-y-2 text-sm leading-6 text-muted-foreground"><li>Google OAuth credentials: {operations.oauthConfigured ? "Configured" : "Missing"}</li><li>Transactional email credentials: {operations.emailConfigured ? "Configured; verify domain and delivery" : "Missing; in-app notifications remain available"}</li><li>App origin: {operations.httpsSite ? "HTTPS configured" : "Local or missing; set production SITE_URL before release"}</li><li>Provisioned organizers: {operations.organizerCount} / 2 required for pilot handover</li><li>Latest 50 email deliveries: {operations.failedEmails} failed, {operations.disabledEmails} disabled</li><li>Latest 20 imports: {operations.failedImports} failed, {operations.stuckImports} past the 20-minute run limit</li></ul><p className="text-xs leading-5 text-muted-foreground">Review source errors in Opportunities / Imports and email errors below. Runtime errors appear in the Convex and Vercel deployment logs.</p></Panel>;
}
