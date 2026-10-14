"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Download, Plus, TriangleAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { activityDate, activityOnDay, inStay, outcomeLabels, overlapping, sprintDays, type SprintActions, type SprintData, type SprintEntry, type SprintOutcome } from "@/lib/sprint";
import { downloadSprint } from "@/lib/sprint-calendar";
import { getSampleSprint, getServerSampleSprint, resetSampleSprint, sampleSprintActions, subscribeSampleSprint } from "@/lib/sample-sprint";
import { dateLabel, dateRangeLabel } from "@/lib/cohort-dates";
import { useWorkspace } from "./workspace-context";
import { ActionButton, Badge, InlineError, LoadingState, PageHeading, Panel, errorMessage } from "./ui";
import { SelectField } from "./opportunity-parts";
import { ActivityEditor, OutcomeEditor, ProgressEditor, RemoveSprintDialog } from "./sprint-editors";
import { ActivityDetails, SprintEntryCard, SprintMissionPanel } from "./sprint-agenda";

export function useSprintActions(cohortId: Id<"cohorts">, management = false): SprintActions {
  const save = useMutation(api.sprint.saveActivity), progress = useMutation(api.sprint.setProgress), remove = useMutation(api.sprint.removeActivity), restore = useMutation(api.sprint.restoreActivity), saveOutcome = useMutation(api.sprint.saveOutcome), removeOutcome = useMutation(api.sprint.removeOutcome);
  return {
    async saveActivity({ input, entry, goalLink, allowOverlap, opportunity }) { await save({ cohortId, scope: management ? "cohort" : "personal", input, activityId: entry?._id as Id<"sprintActivities"> | undefined, expectedRevision: entry?.revision ?? 0, expectedProgressRevision: entry?.progress.revision ?? 0, opportunityId: opportunity?._id as Id<"opportunities"> | undefined, goalLink, allowOverlap }); },
    async setProgress(entry, input) { await progress({ activityId: entry._id as Id<"sprintActivities">, input, expectedActivityRevision: entry.revision, expectedProgressRevision: entry.progress.revision }); },
    async removeActivity(entry) { await remove({ activityId: entry._id as Id<"sprintActivities">, expectedRevision: entry.revision }); },
    async restoreActivity(entry) { await restore({ activityId: entry._id as Id<"sprintActivities">, expectedRevision: entry.revision }); },
    async saveOutcome(input, activityId, outcome) { await saveOutcome({ cohortId, input, activityId: activityId as Id<"sprintActivities"> | undefined, outcomeId: outcome?._id as Id<"sprintOutcomes"> | undefined, expectedUpdatedAt: outcome?.updatedAt }); },
    async removeOutcome(outcome) { await removeOutcome({ outcomeId: outcome._id as Id<"sprintOutcomes">, expectedUpdatedAt: outcome.updatedAt }); },
  };
}

export function SprintDashboard({ cohortId, profileId, management = false }: { cohortId?: Id<"cohorts">; profileId?: Id<"profiles">; management?: boolean }) {
  const { preview, cohorts } = useWorkspace();
  const [selectedId, setSelectedId] = useState("");
  const ordered = [...cohorts].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const selected = cohorts.find((item) => item._id === (cohortId ?? selectedId)) ?? ordered.find((item) => item.status === "active") ?? ordered.find((item) => item.status === "upcoming") ?? ordered.at(-1);
  if (!selected) return <Panel className="space-y-4 p-8"><CalendarDays className="size-7 text-forest" aria-hidden /><h1 className="text-2xl font-medium tracking-tight text-foreground">Your Sprint starts with a cohort</h1><p className="text-sm leading-6 text-muted">Ask your organizer to confirm your cohort and stay dates. Then you can plan your two weeks.</p></Panel>;
  return <div className="space-y-5">{!cohortId && cohorts.length > 1 ? <div className="max-w-sm"><SelectField label="Sprint cohort" value={selected._id} onChange={(event) => setSelectedId(event.target.value)}>{cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.name}</option>)}</SelectField></div> : null}{preview ? <PreviewSprint key={selected._id} /> : <ConnectedSprint key={`${selected._id}:${profileId ?? "own"}:${management}`} cohortId={selected._id} profileId={profileId} management={management} />}</div>;
}

function PreviewSprint() {
  const data = useSyncExternalStore(subscribeSampleSprint, getSampleSprint, getServerSampleSprint);
  return <SprintView data={data} actions={sampleSprintActions} preview />;
}
function ConnectedSprint({ cohortId, profileId, management }: { cohortId: Id<"cohorts">; profileId?: Id<"profiles">; management: boolean }) {
  const personal = useQuery(api.sprint.get, management ? "skip" : { cohortId, profileId });
  const shared = useQuery(api.sprint.shared, management ? { cohortId } : "skip");
  const actions = useSprintActions(cohortId, management);
  const data = management ? shared : personal;
  return data ? <SprintView data={data} actions={actions} /> : <LoadingState label="Opening the Sprint…" />;
}

export function SprintView({ data, actions, preview = false }: { data: SprintData; actions: SprintActions; preview?: boolean }) {
  const [day, setDay] = useState(data.startDate);
  const [view, setView] = useState<"day" | "agenda">("day");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ entry?: SprintEntry; day?: string } | null>(null);
  const [progressEntry, setProgressEntry] = useState<SprintEntry | null>(null);
  const [outcomeEditor, setOutcomeEditor] = useState<{ outcome?: SprintOutcome; activity?: SprintEntry } | null>(null);
  const [removing, setRemoving] = useState<{ entry?: SprintEntry; outcome?: SprintOutcome } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days = sprintDays(data.startDate, data.endDate);
  const selectedDay = days.includes(day) ? day : data.startDate;
  const entries = data.entries.filter((entry) => !entry.cancelledAt).sort((a, b) => (a.startAt ?? Infinity) - (b.startAt ?? Infinity) || a.title.localeCompare(b.title));
  const within = entries.filter((entry) => inStay(entry, data.startDate, data.endDate));
  const unscheduled = within.filter((entry) => !activityDate(entry));
  const outside = entries.filter((entry) => !inStay(entry, data.startDate, data.endDate));
  const cancelled = data.entries.filter((entry) => entry.cancelledAt);
  const selected = data.entries.find((entry) => entry._id === detailId);
  const conflicts = entries.filter((entry) => entry.progress.status !== "skipped" && overlapping(entry, entries, entry._id).length > 0);
  function open(entry: SprintEntry) { setDetailId(entry._id); setError(null); setNotice(""); }
  function exportEntries(items: SprintEntry[]) {
    try { downloadSprint(items, `${preview ? "Sample · " : ""}${data.cohortName} · Sprint`); setNotice("Calendar exported. Timed activities are events; untimed work is exported as to-dos. This file is a snapshot, not a live calendar sync."); }
    catch { setError("Unable to export your calendar. Try again in this browser."); }
  }
  const renderCards = (items: SprintEntry[]) => <div className="space-y-3">{items.map((entry) => <SprintEntryCard key={entry._id} entry={entry} onOpen={() => open(entry)} />)}</div>;
  return <div className="space-y-6">
    <PageHeading title={data.management ? "Cohort Sprint" : data.readOnly ? `${data.profileName ?? "Participant"}’s Sprint` : "Your 14-day Sprint"} description={data.management ? "Plan shared activities and challenges. Hustlers record their own progress." : "Make room for what matters, one day and one useful step at a time."} action={data.canPlan ? <ActionButton onPress={() => setEditor({ day: selectedDay })}><Plus className="size-4" aria-hidden />{data.management ? "Add cohort activity" : "Add activity"}</ActionButton> : undefined} />
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-medium text-foreground">{data.cohortName}</p><p className="mt-2 text-xs leading-6 tabular-nums text-muted">{dateRangeLabel(data.startDate, data.endDate)} · San Francisco time</p></div><ActionButton appearance="secondary" onPress={() => exportEntries(data.entries)} isDisabled={!data.entries.some((entry) => !entry.cancelledAt && entry.progress.status !== "skipped")}><Download className="size-4" aria-hidden />Export Sprint</ActionButton></div>
    {preview ? <p className="text-xs leading-6 text-muted">Sample Sprint · Activities and outcomes are illustrative. Your changes stay in this tab, including on refresh.</p> : data.readOnly ? <p className="text-xs leading-6 text-muted">Organizer view · This participant’s schedule, contributions, and outcomes are read-only.</p> : !data.canPlan && !data.management ? <p className="text-sm leading-6 text-muted">Join this cohort as a participant to keep a personal Sprint. Manage shared activities from the Command Center.</p> : null}
    {notice && !detailId ? <p role="status" className="text-sm leading-6 text-forest">{notice}</p> : null}<InlineError message={detailId ? null : error} />
    {!data.management ? <div className="grid grid-cols-3 gap-2 sm:gap-3">{[{ label: "Planned", count: entries.filter((entry) => entry.progress.status === "planned").length }, { label: "Done / attended", count: entries.filter((entry) => entry.progress.status === "completed").length }, { label: "Reported outcomes", count: data.outcomes.reduce((sum, item) => sum + item.quantity, 0) }].map((item) => <Panel key={item.label} className="p-3 sm:p-5"><p className="min-h-10 text-xs leading-5 text-muted sm:min-h-0">{item.label}</p><p className="mt-3 text-2xl font-medium tabular-nums text-foreground">{item.count}</p></Panel>)}</div> : null}
    {conflicts.length ? <p className="flex items-start gap-2 rounded-xl bg-warm p-4 text-sm leading-6 text-foreground"><TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden />Some scheduled activities overlap. Open an activity to review the times: {conflicts.map((entry) => entry.title).join(", ")}</p> : null}
    <section aria-label="Sprint days" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium tracking-tight text-foreground">Your two weeks</h2><div className="flex flex-wrap gap-2">{[{ value: "day", label: "Day view" }, { value: "agenda", label: "Full agenda" }].map((item) => <button key={item.value} aria-pressed={view === item.value} onClick={() => setView(item.value as typeof view)} className={`min-h-10 rounded-xl px-3 text-sm ${view === item.value ? "bg-sage font-medium text-forest" : "bg-soft text-muted"}`}>{item.label}</button>)}</div></div><div className="grid grid-cols-4 gap-2 sm:grid-cols-7 xl:grid-cols-14">{days.map((date, index) => <button key={date} aria-label={`Day ${index + 1}, ${dateLabel(date, "MMM d")}`} aria-pressed={view === "day" && selectedDay === date} onClick={() => { setDay(date); setView("day"); }} className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs tabular-nums transition-colors ${view === "day" && selectedDay === date ? "border-forest bg-forest text-white" : "border-line bg-white text-muted hover:bg-soft"}`}><span>Day {index + 1}</span><span className="font-medium">{dateLabel(date, "MMM d")}</span><span className={`mt-1 h-1 w-4 rounded-full ${within.some((entry) => activityOnDay(entry, date)) ? view === "day" && selectedDay === date ? "bg-white" : "bg-forest" : "bg-transparent"}`} aria-hidden /></button>)}</div></section>
    <div className={`grid items-start gap-6 ${!data.management ? "xl:grid-cols-[minmax(0,1fr)_300px]" : ""}`}><div className="min-w-0 space-y-6">{(view === "day" ? [selectedDay] : days).map((date) => { const items = within.filter((entry) => activityOnDay(entry, date)); return <section key={date} aria-label={`Agenda for ${dateLabel(date, "MMM d")}`} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium tracking-tight text-foreground">{dateLabel(date, "EEEE, MMM d")}</h2>{data.canPlan ? <button aria-label={`Add activity on ${dateLabel(date, "MMM d")}`} onClick={() => setEditor({ day: date })} className="inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm font-medium text-forest underline-offset-4 hover:underline"><Plus className="size-4" aria-hidden />Add activity</button> : null}</div>{items.length ? renderCards(items) : <Panel className="space-y-2 p-6"><p className="text-sm font-medium text-foreground">Room to make a plan</p><p className="text-sm leading-6 text-muted">{data.canPlan ? "Add a task or meeting, or choose an event from Opportunities." : "No activities scheduled for this day."}</p>{data.canPlan && !data.management ? <Link href={preview ? "/preview/opportunities" : "/opportunities"} className="inline-flex min-h-9 items-center text-sm font-medium text-forest underline-offset-4 hover:underline">Find opportunities</Link> : null}</Panel>}</section>; })}
      <section aria-label="Unscheduled activities" className="space-y-4"><h2 className="text-lg font-medium tracking-tight text-foreground">Unscheduled</h2>{unscheduled.length ? renderCards(unscheduled) : <p className="text-sm leading-6 text-muted">Tasks without a day or time will appear here.</p>}</section>
      {outside.length ? <section aria-label="Activities outside your stay" className="space-y-4"><h2 className="text-lg font-medium tracking-tight text-foreground">Outside your current stay</h2><p className="text-sm leading-6 text-muted">These activities were kept after the stay dates changed, or use the shared cohort dates. Review them before making plans.</p>{renderCards(outside)}</section> : null}
      {cancelled.length ? <details className="rounded-2xl border border-line p-5"><summary className="cursor-pointer text-sm font-medium text-muted">Cancelled cohort activities ({cancelled.length})</summary><div className="mt-4">{renderCards(cancelled)}</div></details> : null}
    </div>{!data.management ? <SprintMissionPanel data={data} preview={preview} /> : null}</div>
    {!data.management ? <section aria-labelledby="sprint-outcomes-heading" className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="sprint-outcomes-heading" className="text-xl font-medium tracking-tight text-foreground">What came from your two weeks</h2><p className="mt-2 text-sm leading-6 text-muted">Self-reported results, kept separate from plans and attendance.</p></div>{data.canPlan ? <ActionButton appearance="secondary" onPress={() => setOutcomeEditor({})}>Record outcome</ActionButton> : null}</div>{data.outcomes.length ? <div className="grid gap-3 md:grid-cols-2">{[...data.outcomes].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).map((outcome) => <Panel key={outcome._id} className="space-y-3 p-5 wrap-anywhere"><div className="flex flex-wrap items-center gap-2"><Badge>{outcomeLabels[outcome.type]}</Badge><span className="text-xs tabular-nums text-muted">{dateLabel(outcome.date)} · Count {outcome.quantity}</span></div><h3 className="text-base font-medium text-foreground">{outcome.title}</h3>{outcome.notes ? <p className="text-sm leading-6 whitespace-pre-wrap text-muted">{outcome.notes}</p> : null}{outcome.activityId ? <button onClick={() => { setDetailId(outcome.activityId!); setError(null); }} className="min-h-9 text-sm font-medium text-forest underline-offset-4 hover:underline">View related activity</button> : null}{data.canPlan ? <div className="flex flex-wrap gap-4"><button aria-label={`Edit outcome ${outcome.title}`} onClick={() => setOutcomeEditor({ outcome })} className="min-h-9 rounded-sm text-sm font-medium text-forest underline-offset-4 hover:underline">Edit outcome</button><button aria-label={`Remove outcome ${outcome.title}`} onClick={() => setRemoving({ outcome })} className="min-h-9 rounded-sm text-sm text-muted underline-offset-4 hover:underline">Remove</button></div> : null}</Panel>)}</div> : <Panel className="space-y-2 p-6"><h3 className="text-base font-medium text-foreground">Record a useful result</h3><p className="text-sm leading-6 text-muted">Meetings, feedback, projects, internships, funding conversations, and other results belong here.</p></Panel>}</section> : null}
    {preview ? <button onClick={() => { resetSampleSprint(); setDay(data.startDate); setNotice("Sample Sprint reset."); }} className="min-h-10 rounded-sm text-sm text-muted underline-offset-4 hover:underline">Reset sample Sprint</button> : null}
    {detailId ? <ActivityDetails entry={selected} data={data} error={error} busy={busy} onClose={() => setDetailId(null)} onEdit={() => { if (selected) setEditor({ entry: selected }); }} onProgress={() => { if (selected) setProgressEntry(selected); }} onOutcome={() => { if (selected) setOutcomeEditor({ activity: selected }); }} onRemove={() => { if (selected) setRemoving({ entry: selected }); }} onRestore={async () => { if (!selected) return; setBusy(true); setError(null); try { await actions.restoreActivity(selected); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }} onExport={() => { if (selected) exportEntries([selected]); }} /> : null}
    {editor ? <ActivityEditor data={data} entry={editor.entry} initialDay={editor.day} onClose={() => setEditor(null)} onSave={async (input, goalLink, allowOverlap) => { await actions.saveActivity({ input, entry: editor.entry, goalLink, allowOverlap }); setNotice(editor.entry ? "Activity updated." : "Activity added to your Sprint."); setEditor(null); }} /> : null}
    {progressEntry ? <ProgressEditor data={data} entry={progressEntry} onClose={() => setProgressEntry(null)} onSave={async (input) => { await actions.setProgress(progressEntry, input); setNotice("Progress saved."); setProgressEntry(null); }} /> : null}
    {outcomeEditor ? <OutcomeEditor data={data} outcome={outcomeEditor.outcome} initialActivityId={outcomeEditor.activity?._id} initialDate={outcomeEditor.activity ? activityDate(outcomeEditor.activity) : selectedDay} onClose={() => setOutcomeEditor(null)} onSave={async (input, activityId) => { await actions.saveOutcome(input, activityId, outcomeEditor.outcome); setNotice("Outcome saved as a self-reported result."); setOutcomeEditor(null); }} /> : null}
    {removing ? <RemoveSprintDialog title={removing.outcome ? "Remove this outcome?" : removing.entry?.scope === "cohort" ? "Cancel this cohort activity?" : "Remove this activity?"} action={removing.outcome ? "Remove outcome" : removing.entry?.scope === "cohort" ? "Cancel cohort activity" : "Remove activity"} description={removing.outcome ? "This permanently removes the reported outcome. Attendance and mission progress stay as recorded." : removing.entry?.scope === "cohort" ? "The cohort will see this activity as cancelled. It stops contributing to goal progress and calendar exports. You can restore it later." : "This removes the activity and its goal contribution. Any reported outcomes are kept without the activity link."} onClose={() => setRemoving(null)} onRemove={async () => { if (removing.outcome) await actions.removeOutcome(removing.outcome); else if (removing.entry) await actions.removeActivity(removing.entry); setRemoving(null); setDetailId(null); setNotice("Sprint updated."); }} /> : null}
  </div>;
}
