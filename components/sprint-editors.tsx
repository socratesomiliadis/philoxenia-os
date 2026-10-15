"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { activityFromOpportunity, activitySchema, assertInStay, overlapping, outcomeLabels, outcomeSchema, outcomeTypes, progressSchema, type ActivityInput, type GoalLink, type OutcomeInput, type ProgressInput, type SprintData, type SprintEntry, type SprintOutcome } from "@/lib/sprint";
import { eventTimeLabel, sfDateTimeInput, type Opportunity } from "@/lib/opportunities";
import { initialOccurrence, parseSprintTime, sfTimeCandidates } from "@/lib/sprint-time";
import { TextareaField, ActionButton, Field, InlineError, errorMessage } from "./ui";
import { SelectField } from "./opportunity-parts";
import { WorkspaceDialog } from "./workspace-dialog";

export function SprintModal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <WorkspaceDialog title={title} onClose={onClose} closeLabel="Close Sprint dialog" bodyClassName="@container/sprint-dialog [&_label]:text-sm [&_label]:leading-5 [&_label]:text-foreground" wide={wide}>{children}</WorkspaceDialog>;
}

function NotesField({ label = "Notes (optional)", value, onChange }: { label?: string; value: string; onChange: (value: string) => void }) {
  return <TextareaField label={label} value={value} onChange={(event) => onChange(event.target.value)} maxLength={3000} rows={3} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6" />;
}

function GoalSelect({ data, value, onChange }: { data: SprintData; value: string; onChange: (value: string) => void }) {
  return <SelectField label="Link to mission goal" value={value} onChange={(event) => onChange(event.target.value)}><option value="">No linked goal</option>{data.goals.map((goal, index) => <option key={index} value={String(index)}>{index + 1}. {goal.title}</option>)}</SelectField>;
}

function RepeatedTime({ label, value, occurrence, onChange }: { label: string; value: string; occurrence: string; onChange: (value: string) => void }) {
  let choices: number[] = [];
  try { choices = sfTimeCandidates(value); } catch { /* The date field handles incomplete and invalid input. */ }
  return choices.length > 1 ? <SelectField label={label} value={occurrence} onChange={(event) => onChange(event.target.value)}><option value="">Choose which occurrence</option><option value="first">First · {eventTimeLabel(choices[0])}</option><option value="second">Second · {eventTimeLabel(choices[1])}</option></SelectField> : null;
}

export function ActivityEditor({ data, entry, opportunity, initialDay, supportMeeting, onSave, onClose }: { data: SprintData; entry?: SprintEntry; opportunity?: Opportunity; initialDay?: string; supportMeeting?: { title: string; notes: string }; onSave: (input: ActivityInput, goal?: GoalLink, allowOverlap?: boolean) => Promise<void>; onClose: () => void }) {
  const initial = entry ?? (supportMeeting ? { kind: "meeting" as const, title: supportMeeting.title, notes: supportMeeting.notes, location: "", startAt: undefined, endAt: undefined, day: undefined } : opportunity ? activityFromOpportunity(opportunity) : { kind: "task" as const, title: "", notes: "", location: "", day: initialDay });
  const [kind, setKind] = useState(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [location, setLocation] = useState(initial.location);
  const [timed, setTimed] = useState(initial.startAt !== undefined || !!supportMeeting);
  const [start, setStart] = useState(initial.startAt === undefined ? "" : sfDateTimeInput(initial.startAt));
  const [end, setEnd] = useState(initial.endAt === undefined ? "" : sfDateTimeInput(initial.endAt));
  const [startOccurrence, setStartOccurrence] = useState(() => initialOccurrence(initial.startAt));
  const [endOccurrence, setEndOccurrence] = useState(() => initialOccurrence(initial.endAt));
  const [day, setDay] = useState(initial.day ?? "");
  const [goal, setGoal] = useState(entry?.progress.goalLink?.missionConfirmedAt === data.missionConfirmedAt && entry?.progress.goalLink ? String(entry.progress.goalLink.index) : "");
  const [missionVersion] = useState(data.missionConfirmedAt);
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function input(): ActivityInput {
    return activitySchema.parse({ kind, title, notes, location, ...(timed ? { startAt: start ? parseSprintTime(start, startOccurrence) : undefined, endAt: end ? parseSprintTime(end, endOccurrence) : undefined } : { day: day || undefined }) });
  }
  let conflicts: SprintEntry[] = [];
  try { conflicts = overlapping(input(), data.entries, entry?._id); } catch { /* Incomplete fields are checked on submit. */ }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    try {
      if (data.missionConfirmedAt !== missionVersion) throw new Error("Your mission changed while editing. Close this editor and reopen it to choose a current goal.");
      const value = input(); assertInStay(value, data.startDate, data.endDate);
      if (conflicts.length && !allowOverlap) throw new Error("Review the overlapping activities, or confirm you want to keep this time.");
      setBusy(true);
      await onSave(value, goal !== "" && data.missionConfirmedAt !== undefined ? { missionConfirmedAt: data.missionConfirmedAt, index: Number(goal) } : undefined, allowOverlap);
    } catch (failure) { setError(failure && typeof failure === "object" && "issues" in failure ? (failure as { issues: { message: string }[] }).issues[0].message : errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <SprintModal title={supportMeeting ? "Schedule agreed support" : entry ? "Edit activity" : opportunity ? "Add opportunity to Sprint" : data.management ? "Add cohort activity" : "Add activity"} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-6">
    <p className="text-sm leading-6 text-muted-foreground">{supportMeeting ? "Enter the time and place you agreed with the alumnus. They’ll receive an update; your Sprint records attendance and outcomes separately." : data.management ? "Shared with the cohort. Each Hustler records their own progress." : "Plan a useful next step. Your schedule is visible to you and the organizers."}</p>
    <div className="space-y-4">
      <Field label="Activity title" required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Review my prototype with a founder" />
      <div className="grid min-w-0 gap-4 @min-[440px]/sprint-dialog:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <SelectField label="Activity type" value={kind} disabled={!!supportMeeting} onChange={(event) => { const value = event.target.value as ActivityInput["kind"]; setKind(value); if (value === "event" || value === "meeting") setTimed(true); }}><option value="task">Task</option><option value="event">Event</option><option value="meeting">Meeting</option><option value="challenge">Challenge</option></SelectField>
        <Field label="Location or meeting link (optional)" maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="SoMa · venue to be confirmed" />
      </div>
    </div>
    <section aria-label="Activity schedule" className="space-y-4 rounded-2xl bg-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h3 className="text-sm font-medium text-foreground">Schedule</h3><span className="text-xs text-muted-foreground">San Francisco time</span></div>
      <label className="flex min-h-10 items-center gap-3 text-sm text-foreground"><input type="checkbox" checked={timed} disabled={kind === "event" || kind === "meeting"} onChange={(event) => { setTimed(event.target.checked); setAllowOverlap(false); }} className="size-4 shrink-0 accent-forest" />Schedule a time</label>
      {timed ? <div className="grid min-w-0 gap-4 @min-[500px]/sprint-dialog:grid-cols-2">
        <div className="min-w-0 space-y-3"><Field label="Starts (SF time)" className="min-w-0" type="datetime-local" required min={`${data.startDate}T00:00`} value={start} onChange={(event) => { setStart(event.target.value); setStartOccurrence(""); setAllowOverlap(false); }} /><RepeatedTime label="Repeated start time" value={start} occurrence={startOccurrence} onChange={(value) => { setStartOccurrence(value); setAllowOverlap(false); }} /></div>
        <div className="min-w-0 space-y-3"><Field label="Ends (SF time)" className="min-w-0" type="datetime-local" required value={end} onChange={(event) => { setEnd(event.target.value); setEndOccurrence(""); setAllowOverlap(false); }} /><RepeatedTime label="Repeated end time" value={end} occurrence={endOccurrence} onChange={(value) => { setEndOccurrence(value); setAllowOverlap(false); }} /></div>
      </div> : <div className="space-y-2"><Field label="Day (optional)" className="min-w-0" type="date" min={data.startDate} max={data.endDate} value={day} onChange={(event) => setDay(event.target.value)} /><p className="text-xs leading-5 text-muted-foreground">Leave the day empty to keep this in Unscheduled. Flexible tasks export as calendar to-dos.</p></div>}
    </section>
    {opportunity ? <p className="rounded-xl bg-sage/60 p-4 text-xs leading-6 text-muted-foreground">Adding this to your Sprint does not register you or arrange a meeting.{opportunity.kind === "event" && opportunity.endAt === undefined ? " No end time was supplied; a one-hour duration is prefilled. Adjust it before saving." : ""}</p> : null}
    {!data.management && !supportMeeting ? <div className="space-y-2"><GoalSelect data={data} value={goal} onChange={setGoal} />{entry?.progress.goalLink && entry.progress.goalLink.missionConfirmedAt !== data.missionConfirmedAt ? <p className="text-xs leading-5 text-muted-foreground">This activity was linked to a previous mission. Choose a current goal to relink it.</p> : null}<p className="text-xs leading-5 text-muted-foreground">{entry?.progress.goalLink ? "Changing the linked goal resets this activity’s contribution. Update progress after you complete it." : "Link a goal, then report your contribution when you complete this activity."}</p></div> : null}
    <details open={initial.notes ? true : undefined} className="rounded-xl border border-line px-4 py-3"><summary className="cursor-pointer text-sm font-medium text-muted-foreground">{initial.notes ? "Activity notes" : "Add notes (optional)"}</summary><div className="pt-4"><NotesField value={notes} onChange={setNotes} /></div></details>
    {conflicts.length ? <div className="space-y-3 rounded-xl bg-warm p-4"><p className="flex items-start gap-2 text-sm leading-6 text-foreground"><TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden />Overlaps: {conflicts.map((item) => item.title).join(", ")}</p><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={allowOverlap} onChange={(event) => setAllowOverlap(event.target.checked)} className="mt-1 size-4 shrink-0 accent-forest" />Keep overlapping time</label></div> : null}
    <InlineError message={error} /><div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><ActionButton appearance="secondary" disabled={busy} onClick={onClose}>Cancel</ActionButton><ActionButton type="submit" busy={busy}>{entry ? "Save activity" : "Add to Sprint"}</ActionButton></div>
  </form></SprintModal>;
}

export function ProgressEditor({ data, entry, onSave, onClose }: { data: SprintData; entry: SprintEntry; onSave: (input: ProgressInput) => Promise<void>; onClose: () => void }) {
  const [status, setStatus] = useState(entry.progress.status);
  const [goal, setGoal] = useState(entry.progress.goalLink?.missionConfirmedAt === data.missionConfirmedAt && entry.progress.goalLink ? String(entry.progress.goalLink.index) : "");
  const [missionVersion] = useState(data.missionConfirmedAt);
  const [contribution, setContribution] = useState(String(entry.progress.status === "completed" ? entry.progress.contribution : 1));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (data.missionConfirmedAt !== missionVersion) { setError("Your mission changed while editing. Close this editor and reopen it to choose a current goal."); return; }
    const input = progressSchema.safeParse({ status, goalLink: goal !== "" && data.missionConfirmedAt !== undefined ? { index: Number(goal), missionConfirmedAt: data.missionConfirmedAt } : undefined, contribution: status === "completed" && goal !== "" ? Number(contribution) : 0 });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    setBusy(true);
    try { await onSave(input.data); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <SprintModal title="Progress & attendance" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5">
    <h3 className="text-base font-medium text-foreground">{entry.title}</h3>
    <SelectField label="Activity status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
      <option value="planned">Planned</option>
      <option value="completed">{entry.kind === "event" || entry.kind === "meeting" ? "Attended" : "Completed"}</option>
      <option value="skipped">Skipped / did not attend</option>
    </SelectField>
    <GoalSelect data={data} value={goal} onChange={(value) => { setGoal(value); setContribution("0"); }} />
    {status === "completed" && goal !== "" ? <>
      <Field label="Contribution to this goal" type="number" required min={0} max={100} step={1} value={contribution} onChange={(event) => setContribution(event.target.value)} />
      <p className="text-xs leading-6 text-muted-foreground">Units: {data.goals[Number(goal)]?.metric}. Enter only what you achieved. Zero records completion without adding goal progress.</p>
    </> : <p className="text-xs leading-6 text-muted-foreground">Only completed activities with a current goal link contribute to mission progress.</p>}
    <InlineError message={error} />
    <div className="flex flex-wrap justify-end gap-3"><ActionButton appearance="secondary" disabled={busy} onClick={onClose}>Cancel</ActionButton><ActionButton type="submit" busy={busy}>Save progress</ActionButton></div>
  </form></SprintModal>;
}

export function OutcomeEditor({ data, outcome, initialActivityId, initialDate, onSave, onClose }: { data: SprintData; outcome?: SprintOutcome; initialActivityId?: string; initialDate?: string; onSave: (input: OutcomeInput, activityId?: string) => Promise<void>; onClose: () => void }) {
  const [type, setType] = useState<OutcomeInput["type"]>(outcome?.type ?? "meeting");
  const [title, setTitle] = useState(outcome?.title ?? "");
  const [notes, setNotes] = useState(outcome?.notes ?? "");
  const [date, setDate] = useState(outcome?.date ?? initialDate ?? data.startDate);
  const [quantity, setQuantity] = useState(String(outcome?.quantity ?? 1));
  const [activityId, setActivityId] = useState(outcome?.activityId ?? initialActivityId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const input = outcomeSchema.safeParse({ type, title, notes, date, quantity: Number(quantity) });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    setBusy(true);
    try { await onSave(input.data, activityId || undefined); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <SprintModal title={outcome ? "Edit outcome" : "Record outcome"} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-6">
    <p className="text-sm leading-6 text-muted-foreground">Capture a result from your Sprint. Outcomes are self-reported and visible to you and the organizers.</p>
    <div className="space-y-4">
      <Field label="What happened?" required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Received feedback on the onboarding prototype" />
      <SelectField label="Outcome type" value={type} onChange={(event) => setType(event.target.value as typeof type)}>{outcomeTypes.map((value) => <option key={value} value={value}>{outcomeLabels[value]}</option>)}</SelectField>
      <div className="grid min-w-0 gap-4 @min-[400px]/sprint-dialog:grid-cols-2"><Field label="Outcome date" className="min-w-0" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /><Field label="Count" type="number" required min={1} max={100} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
    </div>
    <div className="space-y-4 border-t border-line pt-5"><SelectField label="Related activity (optional)" value={activityId} onChange={(event) => setActivityId(event.target.value)}><option value="">No linked activity</option>{data.entries.map((entry) => <option key={entry._id} value={entry._id}>{entry.title}</option>)}</SelectField><NotesField label="Details (optional)" value={notes} onChange={setNotes} /></div>
    <p className="text-xs leading-5 text-muted-foreground">Recording an outcome doesn’t change attendance or mission progress.</p>
    <InlineError message={error} /><div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><ActionButton appearance="secondary" disabled={busy} onClick={onClose}>Cancel</ActionButton><ActionButton type="submit" busy={busy}>Save outcome</ActionButton></div>
  </form></SprintModal>;
}

export function RemoveSprintDialog({ title, description, action, onClose, onRemove }: { title: string; description: string; action: string; onClose: () => void; onRemove: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <SprintModal title={title} onClose={() => { if (!busy) onClose(); }}><div className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">{description}</p><InlineError message={error} /><div className="flex flex-wrap justify-end gap-3"><ActionButton appearance="secondary" disabled={busy} onClick={onClose}>Keep it</ActionButton><ActionButton appearance="danger" busy={busy} onClick={async () => { setBusy(true); setError(null); try { await onRemove(); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }}>{action}</ActionButton></div></div></SprintModal>;
}
