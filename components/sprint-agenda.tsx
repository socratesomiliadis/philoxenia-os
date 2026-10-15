"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Flag, MapPin, Target, TriangleAlert, UsersRound } from "lucide-react";
import { activityLabels, goalTotals, inStay, overlapping, type SprintData, type SprintEntry } from "@/lib/sprint";
import { dateLabel } from "@/lib/cohort-dates";
import { eventTimeLabel } from "@/lib/opportunities";
import { sprintTimeRange } from "@/lib/sprint-time";
import { ActionButton, Badge, InlineError } from "./ui";
import { SprintModal } from "./sprint-editors";

export function SprintEntryCard({ entry, onOpen }: { entry: SprintEntry; onOpen: () => void }) {
  const completed = entry.progress.status === "completed";
  const label = entry.cancelledAt ? "Cancelled" : completed ? entry.kind === "event" || entry.kind === "meeting" ? "Attended" : "Completed" : entry.progress.status === "skipped" ? "Skipped" : "Planned";
  const Icon = completed && !entry.cancelledAt ? Check : entry.kind === "challenge" ? Flag : entry.startAt === undefined ? Check : CalendarDays;
  return <article className="group relative min-w-0 rounded-2xl border border-line bg-white transition-colors duration-150 hover:border-forest/25 hover:bg-soft/35 focus-within:border-forest/40">
    <div className="flex items-start gap-3.5 p-4 @min-[640px]:gap-4 @min-[640px]:p-5">
      <span className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${completed && !entry.cancelledAt ? "bg-sage text-forest" : "bg-soft text-muted-foreground"}`}><Icon className="size-[18px]" strokeWidth={1.7} aria-hidden /></span>
      <div className="min-w-0 flex-1 wrap-anywhere">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-5 text-muted-foreground"><span>{activityLabels[entry.kind]}</span>{entry.scope === "cohort" ? <span className="inline-flex items-center gap-1 text-forest"><UsersRound className="size-3" aria-hidden />Cohort</span> : null}</div>
        <h3 className="mt-1.5 text-base leading-6 font-medium tracking-[-0.02em] text-foreground @min-[640px]:text-lg">
          <button onClick={onOpen} aria-label={`View activity ${entry.title}`} className="text-start after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-3 focus-visible:after:outline-forest">{entry.title}</button>
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-5 text-muted-foreground">
          <span className="inline-flex items-start gap-1.5"><Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>{entry.startAt === undefined ? "Flexible time" : sprintTimeRange(entry.startAt, entry.endAt!)}</span></span>
          {entry.location ? <span className="inline-flex min-w-0 items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>{entry.location}</span></span> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 @min-[640px]:hidden"><Badge tone={completed && !entry.cancelledAt ? "green" : "neutral"}>{label}</Badge></div>
      </div>
      <div className="flex shrink-0 items-center gap-3"><span className="hidden @min-[640px]:inline-flex"><Badge tone={completed && !entry.cancelledAt ? "green" : "neutral"}>{label}</Badge></span><ChevronRight className="mt-1 size-4 text-muted-foreground/60 group-hover:text-forest rtl:rotate-180" aria-hidden /></div>
    </div>
  </article>;
}

export function SprintMissionPanel({ data, preview }: { data: SprintData; preview: boolean }) {
  const totals = goalTotals(data.entries, data.missionConfirmedAt);
  return <aside aria-label="Mission progress" className="min-w-0 rounded-2xl bg-sage/55 p-5 @min-[640px]:p-6">
    <div className="flex items-center gap-2.5"><Target className="size-[18px] text-forest" strokeWidth={1.7} aria-hidden /><h2 className="text-base font-medium tracking-tight text-foreground">Mission progress</h2></div>
    {data.goals.length ? <>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Turn your plans into progress on your three goals.</p>
      <div className="mt-6 space-y-6">{data.goals.map((goal, index) => <div key={index}>
        <h3 className="text-sm leading-5 font-medium wrap-anywhere text-foreground">{goal.title}</h3>
        <div className="mt-2.5 flex items-center justify-between gap-3 text-xs leading-5 text-muted-foreground"><span className="min-w-0 wrap-anywhere">{goal.metric}</span><span className="shrink-0 font-medium tabular-nums text-forest">{totals[index]} / {goal.target}</span></div>
        <progress aria-label={goal.title} value={Math.min(totals[index], goal.target)} max={goal.target} className="mt-2 block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-forest/10 [&::-webkit-progress-bar]:bg-forest/10 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-forest [&::-moz-progress-bar]:bg-forest" />
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">By {dateLabel(goal.deadline, "MMM d")}</p>
      </div>)}</div>
      <p className="mt-6 border-t border-forest/10 pt-4 text-xs leading-5 text-muted-foreground">Progress counts contributions you report on completed, linked activities.</p>
    </> : <div className="mt-4"><h3 className="text-sm font-medium text-foreground">Give your Sprint a direction</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Confirm your three mission goals, then link activities to track what moves forward.</p></div>}
    {!data.readOnly ? <Link href={preview ? "/preview/onboarding" : "/onboarding"} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-forest/15 bg-white/75 px-3 text-xs font-medium text-forest hover:bg-white">Review mission</Link> : null}
  </aside>;
}

export function ActivityDetails({ entry, data, error, busy, onClose, onEdit, onProgress, onOutcome, onRemove, onRestore, onExport }: {
  entry?: SprintEntry; data: SprintData; error: string | null; busy: boolean; onClose: () => void; onEdit: () => void; onProgress: () => void; onOutcome: () => void; onRemove: () => void; onRestore: () => Promise<void>; onExport: () => void;
}) {
  const removalAction = useRef<HTMLButtonElement>(null);
  if (!entry) return <SprintModal title="Activity unavailable" onClose={onClose}><p className="text-sm leading-6 text-muted-foreground">This activity was removed. Close this view to return to your Sprint.</p></SprintModal>;
  const conflicts = overlapping(entry, data.entries, entry._id);
  const canEdit = !data.readOnly && (data.management || (data.canPlan && entry.scope === "personal"));
  const currentGoal = entry.progress.goalLink?.missionConfirmedAt === data.missionConfirmedAt ? data.goals[entry.progress.goalLink?.index ?? -1] : null;
  return <SprintModal title={entry.title} onClose={onClose}><div className="space-y-5"><div className="flex flex-wrap gap-2"><Badge>{activityLabels[entry.kind]}</Badge>{entry.scope === "cohort" ? <Badge tone="green">Shared cohort activity</Badge> : <Badge>Personal</Badge>}{entry.cancelledAt ? <Badge>Cancelled</Badge> : null}</div><div className="space-y-2 text-sm leading-6 text-muted-foreground"><p className="flex items-start gap-2"><Clock3 className="mt-1 size-4 shrink-0" aria-hidden />{entry.startAt === undefined ? entry.day ? `${dateLabel(entry.day)} · untimed` : "Unscheduled task" : <span>{eventTimeLabel(entry.startAt)}<br />Ends {eventTimeLabel(entry.endAt!)}</span>}</p>{entry.location ? <p className="flex items-start gap-2"><MapPin className="mt-1 size-4 shrink-0" aria-hidden />{entry.location}</p> : null}</div>{entry.notes ? <p className="text-sm leading-7 whitespace-pre-wrap text-muted-foreground">{entry.notes}</p> : null}
    {entry.sourceUrl ? <p className="text-sm leading-6 text-muted-foreground"><a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-forest underline underline-offset-4">Original opportunity<ArrowUpRight className="size-4" aria-hidden /></a><span className="mt-2 block text-xs">Scheduling does not register you or confirm a meeting.</span></p> : null}
    {entry.sourceChanged || entry.sourceUnavailable ? <p className="rounded-xl bg-warm p-4 text-sm leading-6">{entry.sourceUnavailable ? "The original opportunity is unavailable or reported cancelled." : "The original opportunity has changed since you added it."} Check the source before attending. Your saved schedule is preserved.</p> : null}
    {!inStay(entry, data.startDate, data.endDate) ? <p className="rounded-xl bg-warm p-4 text-sm leading-6">Outside the current stay dates. {entry.scope === "cohort" ? "Ask your organizer about this cohort activity." : "Edit this activity to bring it into your current stay."}</p> : null}
    {conflicts.length && !entry.cancelledAt && entry.progress.status !== "skipped" ? <p className="flex items-start gap-2 rounded-xl bg-warm p-4 text-sm leading-6"><TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden />Overlaps: {conflicts.map((item) => item.title).join(", ")}</p> : null}
    {!data.management ? <section className="space-y-2 rounded-2xl bg-soft p-4"><h3 className="text-sm font-medium text-foreground">Progress & attendance</h3><p className="text-sm text-muted-foreground">{entry.progress.status === "completed" ? entry.kind === "event" || entry.kind === "meeting" ? "Attended" : "Completed" : entry.progress.status === "skipped" ? "Skipped / did not attend" : "Planned"}</p><p className="text-xs leading-6 text-muted-foreground">{currentGoal ? `${currentGoal.title} · ${entry.progress.status === "completed" && !entry.cancelledAt ? entry.progress.contribution : 0} reported units` : entry.progress.goalLink ? "Linked to a previous mission. Relink it to count toward a current goal." : "No linked mission goal."}</p>{entry.progress.revision > 0 && entry.progress.activityRevision !== entry.revision ? <p className="text-xs leading-6 text-muted-foreground">The shared schedule changed after your last update. Review your attendance and progress.</p> : null}</section> : null}
    <InlineError message={error} /><div className="flex flex-wrap gap-3 border-t border-line pt-5">{data.canPlan && !data.management && !entry.cancelledAt ? <ActionButton onClick={onProgress}>Update progress</ActionButton> : null}{canEdit && !entry.cancelledAt ? <ActionButton appearance="secondary" onClick={onEdit}>Edit activity</ActionButton> : null}{data.canPlan && !data.management ? <ActionButton appearance="secondary" onClick={onOutcome}>Record outcome</ActionButton> : null}{!entry.cancelledAt && entry.progress.status !== "skipped" ? <ActionButton appearance="secondary" onClick={onExport}>Export activity</ActionButton> : null}{canEdit && (!entry.cancelledAt || data.management) ? <ActionButton ref={removalAction} appearance="secondary" busy={busy} onClick={async () => { if (entry.cancelledAt) { await onRestore(); requestAnimationFrame(() => removalAction.current?.focus()); } else onRemove(); }}>{entry.cancelledAt ? "Restore cohort activity" : entry.scope === "cohort" ? "Cancel cohort activity" : "Remove activity"}</ActionButton> : null}</div>
  </div></SprintModal>;
}
