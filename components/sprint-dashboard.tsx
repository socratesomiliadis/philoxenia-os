"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Clock3, TriangleAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { activityDate, activityOnDay, inStay, overlapping, sprintDays, type SprintActions, type SprintData, type SprintEntry, type SprintOutcome } from "@/lib/sprint";
import { downloadSprint } from "@/lib/sprint-calendar";
import { getSampleSprint, getServerSampleSprint, resetSampleSprint, sampleSprintActions, subscribeSampleSprint } from "@/lib/sample-sprint";
import { useWorkspace } from "./workspace-context";
import { InlineError, LoadingState, Panel, errorMessage } from "./ui";
import { SelectField } from "./opportunity-parts";
import { ActivityEditor, OutcomeEditor, ProgressEditor, RemoveSprintDialog } from "./sprint-editors";
import { ActivityDetails, SprintEntryCard, SprintMissionPanel } from "./sprint-agenda";
import { SprintDayPicker, SprintDaySchedule, SprintHeader, SprintSummary } from "./sprint-planner";
import { SprintOutcomes } from "./sprint-outcomes";

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
  const hasPersonalSprint = !data.management && (data.canPlan || data.readOnly || data.goals.length > 0 || data.outcomes.length > 0 || data.entries.some((entry) => entry.scope === "personal"));
  function open(entry: SprintEntry) { setDetailId(entry._id); setError(null); setNotice(""); }
  function exportEntries(items: SprintEntry[]) {
    try { downloadSprint(items, `${preview ? "Sample · " : ""}${data.cohortName} · Sprint`); setNotice("Calendar exported. Timed activities are events; untimed work is exported as to-dos. This file is a snapshot, not a live calendar sync."); }
    catch { setError("Unable to export your calendar. Try again in this browser."); }
  }
  function selectDay(date: string) { setDay(date); setView("day"); }
  const renderCards = (items: SprintEntry[]) => <div className="space-y-3">{items.map((entry) => <SprintEntryCard key={entry._id} entry={entry} onOpen={() => open(entry)} />)}</div>;
  return <div className="@container"><div className="space-y-6 @min-[640px]:space-y-8">
    <SprintHeader data={data} sharedOnly={!data.management && !hasPersonalSprint} onAdd={() => setEditor({ day: selectedDay })} onExport={() => exportEntries(data.entries)} />
    {data.readOnly || (!data.canPlan && hasPersonalSprint) ? <p className="rounded-xl bg-soft px-4 py-3 text-xs leading-5 text-muted">{data.readOnly ? "Organizer view · This participant’s Sprint is read-only." : "Personal planning is unavailable for this cohort. Your saved activities and outcomes are still shown."}</p> : !data.canPlan && !data.management ? <div className="rounded-2xl bg-sage/60 px-5 py-4"><p className="text-sm font-medium text-forest">You’re viewing the cohort schedule</p><p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Manage shared activities in the Command Center. Join the cohort as a participant to keep a personal Sprint.</p></div> : null}
    {notice && !detailId ? <p role="status" className="rounded-xl bg-sage px-4 py-3 text-sm leading-6 text-forest">{notice}</p> : null}
    <InlineError message={detailId ? null : error} />
    {hasPersonalSprint ? <SprintSummary entries={entries} outcomes={data.outcomes} /> : null}
    {conflicts.length ? <div className="flex items-start gap-3 rounded-xl bg-warm p-4 text-sm leading-6 text-foreground"><TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden /><div><p className="font-medium">Some activities overlap</p><p className="text-muted">Open an activity to review its time: {conflicts.map((entry) => entry.title).join(", ")}</p></div></div> : null}
    <SprintDayPicker days={days} entries={within} selectedDay={selectedDay} view={view} onDay={selectDay} onView={setView} />
    <div className={`grid items-start gap-8 border-t border-line pt-7 ${hasPersonalSprint ? "@min-[880px]:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
      <div className="min-w-0 space-y-8">
        {(view === "day" ? [selectedDay] : days).map((date) => <SprintDaySchedule key={date} date={date} items={within.filter((entry) => activityOnDay(entry, date))} dayIndex={days.indexOf(date)} days={days} data={data} preview={preview} fullAgenda={view === "agenda"} onDay={selectDay} onAdd={() => setEditor({ day: date })} onOpen={open} />)}
        {unscheduled.length ? <section aria-label="Unscheduled activities" className="space-y-4 rounded-2xl bg-soft/65 p-4 @min-[640px]:p-5">
          <div className="flex items-center gap-2.5"><Clock3 className="size-4 text-muted" aria-hidden /><h2 className="text-base font-medium tracking-tight text-foreground">Unscheduled</h2><span className="ms-auto text-xs tabular-nums text-muted">{unscheduled.length}</span></div>
          <p className="text-xs leading-5 text-muted">Ideas and tasks to fit in when the time is right.</p>
          {renderCards(unscheduled)}
        </section> : null}
        {outside.length ? <section aria-label="Activities outside your stay" className="space-y-4"><h2 className="text-lg font-medium tracking-tight text-foreground">Outside your current stay</h2><p className="text-sm leading-6 text-muted">These activities fall outside your stay dates. Review their dates before making plans.</p>{renderCards(outside)}</section> : null}
        {cancelled.length ? <details className="rounded-2xl border border-line p-5"><summary className="cursor-pointer text-sm font-medium text-muted">Cancelled cohort activities ({cancelled.length})</summary><div className="mt-4">{renderCards(cancelled)}</div></details> : null}
      </div>
      {hasPersonalSprint ? <SprintMissionPanel data={data} preview={preview} /> : null}
    </div>
    {hasPersonalSprint ? <SprintOutcomes data={data} onRecord={() => setOutcomeEditor({})} onEdit={(outcome) => setOutcomeEditor({ outcome })} onRemove={(outcome) => setRemoving({ outcome })} onActivity={(id) => { setDetailId(id); setError(null); }} /> : null}
    {preview ? <button onClick={() => { resetSampleSprint(); setDay(data.startDate); setNotice("Sample Sprint reset."); }} className="min-h-10 rounded-sm text-sm text-muted underline-offset-4 hover:underline">Reset sample Sprint</button> : null}
    {detailId ? <ActivityDetails entry={selected} data={data} error={error} busy={busy} onClose={() => setDetailId(null)} onEdit={() => { if (selected) setEditor({ entry: selected }); }} onProgress={() => { if (selected) setProgressEntry(selected); }} onOutcome={() => { if (selected) setOutcomeEditor({ activity: selected }); }} onRemove={() => { if (selected) setRemoving({ entry: selected }); }} onRestore={async () => { if (!selected) return; setBusy(true); setError(null); try { await actions.restoreActivity(selected); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }} onExport={() => { if (selected) exportEntries([selected]); }} /> : null}
    {editor ? <ActivityEditor data={data} entry={editor.entry} initialDay={editor.day} onClose={() => setEditor(null)} onSave={async (input, goalLink, allowOverlap) => { await actions.saveActivity({ input, entry: editor.entry, goalLink, allowOverlap }); setNotice(editor.entry ? "Activity updated." : "Activity added to your Sprint."); setEditor(null); }} /> : null}
    {progressEntry ? <ProgressEditor data={data} entry={progressEntry} onClose={() => setProgressEntry(null)} onSave={async (input) => { await actions.setProgress(progressEntry, input); setNotice("Progress saved."); setProgressEntry(null); }} /> : null}
    {outcomeEditor ? <OutcomeEditor data={data} outcome={outcomeEditor.outcome} initialActivityId={outcomeEditor.activity?._id} initialDate={outcomeEditor.activity ? activityDate(outcomeEditor.activity) : selectedDay} onClose={() => setOutcomeEditor(null)} onSave={async (input, activityId) => { await actions.saveOutcome(input, activityId, outcomeEditor.outcome); setNotice("Outcome saved as a self-reported result."); setOutcomeEditor(null); }} /> : null}
    {removing ? <RemoveSprintDialog title={removing.outcome ? "Remove this outcome?" : removing.entry?.scope === "cohort" ? "Cancel this cohort activity?" : "Remove this activity?"} action={removing.outcome ? "Remove outcome" : removing.entry?.scope === "cohort" ? "Cancel cohort activity" : "Remove activity"} description={removing.outcome ? "This permanently removes the reported outcome. Attendance and mission progress stay as recorded." : removing.entry?.scope === "cohort" ? "The cohort will see this activity as cancelled. It stops contributing to goal progress and calendar exports. You can restore it later." : "This removes the activity and its goal contribution. Any reported outcomes are kept without the activity link."} onClose={() => setRemoving(null)} onRemove={async () => { if (removing.outcome) await actions.removeOutcome(removing.outcome); else if (removing.entry) await actions.removeActivity(removing.entry); setRemoving(null); setDetailId(null); setNotice("Sprint updated."); }} /> : null}
  </div></div>;
}
