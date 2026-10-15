"use client";

import { useQuery } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CalendarDays, CheckCheck, ChevronRight, Clock3, MapPin, Trophy } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { dateLabel, dateRangeLabel } from "@/lib/cohort-dates";
import { homeSprintSummary, homeStayProgress } from "@/lib/home-dashboard";
import { getSampleSprint, getServerSampleSprint, subscribeSampleSprint } from "@/lib/sample-sprint";
import { activityDate, activityLabels, type SprintData, type SprintEntry } from "@/lib/sprint";
import { sprintTimeRange } from "@/lib/sprint-time";
import { MissionSummary } from "./mission-summary";
import { useWorkspace, type Cohort } from "./workspace-context";
import { Badge, Panel } from "./ui";
import { WorkspaceDialog } from "./workspace-dialog";

export function HomeOverview({ cohort, organizerOnly }: { cohort?: Cohort; organizerOnly: boolean }) {
  const { preview, viewer } = useWorkspace();
  if (preview) return <PreviewHome cohort={cohort} />;
  if (cohort && viewer?.profile) return <ConnectedHome key={cohort._id} cohort={cohort} organizerOnly={organizerOnly} />;
  return <HomeWidgets cohort={cohort} />;
}

function PreviewHome({ cohort }: { cohort?: Cohort }) {
  const data = useSyncExternalStore(subscribeSampleSprint, getSampleSprint, getServerSampleSprint);
  return <HomeWidgets cohort={cohort} data={data} />;
}

function ConnectedHome({ cohort, organizerOnly }: { cohort: Cohort; organizerOnly: boolean }) {
  const personal = useQuery(api.sprint.get, organizerOnly ? "skip" : { cohortId: cohort._id });
  const shared = useQuery(api.sprint.shared, organizerOnly ? { cohortId: cohort._id } : "skip");
  return <HomeWidgets cohort={cohort} data={organizerOnly ? shared : personal} loading />;
}

function HomeWidgets({ cohort, data, loading = false }: { cohort?: Cohort; data?: SprintData; loading?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const summary = data && now !== null ? homeSprintSummary(data, now) : null;
  const pending = (loading && !data) || now === null;
  const selected = data?.entries.find((entry) => entry._id === selectedId && !entry.cancelledAt);
  return <>
    <StayWidget cohort={cohort} startDate={data?.startDate ?? cohort?.startDate} endDate={data?.endDate ?? cohort?.endDate} now={now} />
    <div className="grid items-start gap-5 @min-[880px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @min-[640px]:gap-6">
      <Panel className="p-5 @min-[640px]:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2.5 text-base font-medium"><CalendarDays className="size-[18px] text-forest" aria-hidden />Up next</h2><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden />San Francisco time</span></div>
        {pending ? <p role="status" className="py-10 text-sm text-muted-foreground">Loading your schedule…</p> : summary?.upcoming.length ? <ol className="mt-5 space-y-2">{summary.upcoming.map((entry) => <UpcomingActivity key={entry._id} entry={entry} now={now!} onOpen={() => setSelectedId(entry._id)} />)}</ol> : <div className="flex min-h-52 flex-col items-center justify-center py-8 text-center"><span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-sage text-forest"><CalendarDays className="size-5" aria-hidden /></span><h3 className="text-sm font-medium">Room for your next step.</h3><p className="mt-2 max-w-64 text-sm leading-6 text-muted-foreground">{data ? "Your next scheduled activities will appear here." : "Your cohort schedule will appear once your stay is confirmed."}</p></div>}
        {summary?.flexible ? <p className="mt-4 pt-4 text-xs leading-5 text-muted-foreground">{summary.flexible} {summary.flexible === 1 ? "activity" : "activities"} still to find a day for.</p> : null}
      </Panel>
      <div className="min-w-0 space-y-5 @min-[640px]:space-y-6">
        {data && !data.management ? <MomentumWidget summary={summary} pending={pending} /> : null}
        <MissionSummary cohort={cohort} />
      </div>
    </div>
    {selectedId ? <WorkspaceDialog title={selected?.title ?? "Activity unavailable"} onClose={() => setSelectedId(null)}>{selected ? <div className="space-y-5"><div className="flex flex-wrap gap-2"><Badge tone="green">{activityLabels[selected.kind]}</Badge>{selected.scope === "cohort" ? <Badge>With your cohort</Badge> : null}</div><p className="text-sm leading-6">{activityDate(selected) ? dateLabel(activityDate(selected)!, "EEEE, MMMM d") : "Not scheduled"}<br /><span className="text-muted-foreground">{selected.startAt === undefined ? "Flexible time" : sprintTimeRange(selected.startAt, selected.endAt!)}</span></p>{selected.location ? <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"><MapPin className="mt-1 size-4 shrink-0" aria-hidden /><span className="wrap-anywhere">{selected.location}</span></p> : null}{selected.notes ? <p className="text-sm leading-7 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{selected.notes}</p> : null}</div> : <p className="text-sm text-muted-foreground">This activity was removed from your schedule.</p>}</WorkspaceDialog> : null}
  </>;
}

function StayWidget({ cohort, startDate, endDate, now }: { cohort?: Cohort; startDate?: string; endDate?: string; now: number | null }) {
  const { preview, viewer } = useWorkspace();
  const stay = startDate && endDate && now !== null ? homeStayProgress(startDate, endDate, now) : null;
  return <Panel className="overflow-hidden bg-sage/75 p-5 @min-[640px]:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-medium text-forest"><MapPin className="size-4" aria-hidden />Your stay · San Francisco</h2>
        {startDate && endDate ? <p className="mt-3 text-2xl leading-8 font-medium tracking-tight tabular-nums text-forest @min-[640px]:text-3xl">{dateRangeLabel(startDate, endDate)}</p> : <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{viewer?.isOrganizer ? "Create a cohort to set the stay dates." : "Your organizer will confirm your cohort and stay dates."}</p>}
        {cohort ? <p className="mt-2 text-xs leading-5 text-forest/75 wrap-anywhere">{cohort.name}</p> : null}
      </div>
      <Badge tone={preview || cohort?.status === "upcoming" ? "gold" : cohort?.status === "active" ? "green" : "neutral"}>{preview ? "Sample cohort" : cohort ? cohort.status === "active" ? "In progress" : cohort.status === "upcoming" ? "Upcoming" : "Completed" : "Not assigned"}</Badge>
    </div>
    {stay ? <div className="mt-6 pt-4"><div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-5"><p className="font-medium tabular-nums text-forest">{stay.label}</p><p className="text-forest/65">{stay.days.length} days of possibility</p></div><div role="img" aria-label={stay.label} className="mt-3 flex gap-1.5">{stay.days.map((day, index) => <span key={day} className={`h-1.5 min-w-0 flex-1 rounded-full ${index === stay.dayIndex ? "bg-gold" : index < stay.elapsed ? "bg-forest" : "bg-forest/10"}`} />)}</div></div> : null}
  </Panel>;
}

function UpcomingActivity({ entry, now, onOpen }: { entry: SprintEntry; now: number; onOpen: () => void }) {
  const date = activityDate(entry)!;
  const ongoing = entry.startAt !== undefined && entry.startAt <= now;
  return <li><button onClick={onOpen} className="group flex w-full min-w-0 items-start gap-3.5 rounded-xl p-3 text-start transition-colors duration-150 hover:bg-sage/45 @min-[640px]:gap-4">
    <span className={`flex w-11 shrink-0 flex-col items-center rounded-xl py-2 ${ongoing ? "bg-gold-soft text-gold-foreground" : "bg-soft text-forest"}`}><span className="text-[10px] font-medium uppercase tracking-wider">{dateLabel(date, "MMM")}</span><span className="mt-0.5 text-xl leading-6 font-medium tabular-nums">{dateLabel(date, "d")}</span></span>
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-muted-foreground">{ongoing ? <span className="font-medium text-gold-foreground">Happening now</span> : dateLabel(date, "EEEE")}<span aria-hidden>·</span>{entry.scope === "cohort" ? "With your cohort" : activityLabels[entry.kind]}</span><span className="mt-1 block text-sm leading-6 font-medium wrap-anywhere">{entry.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{entry.startAt === undefined ? "Flexible time" : sprintTimeRange(entry.startAt, entry.endAt!)}</span>{entry.location ? <span className="mt-1 block text-xs leading-5 text-muted-foreground wrap-anywhere">{entry.location}</span> : null}</span>
    <ChevronRight className="mt-5 size-4 shrink-0 text-muted-foreground/50 group-hover:text-forest rtl:rotate-180" aria-hidden />
  </button></li>;
}

function MomentumWidget({ summary, pending }: { summary: ReturnType<typeof homeSprintSummary> | null; pending: boolean }) {
  return <Panel className="p-5 @min-[640px]:p-6"><h2 className="text-base font-medium">Your momentum</h2><dl aria-label="Sprint progress" className="mt-5 grid grid-cols-3 gap-3">{[
    { label: "Planned", value: summary?.planned, icon: CalendarDays, tone: "bg-soft text-muted-foreground" },
    { label: "Completed", value: summary?.completed, icon: CheckCheck, tone: "bg-sage text-forest" },
    { label: "Outcomes", value: summary?.outcomes, icon: Trophy, tone: "bg-gold-soft text-gold-foreground" },
  ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="min-w-0"><dt className="flex flex-col items-start gap-2 text-xs leading-5 text-muted-foreground"><span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" strokeWidth={1.7} aria-hidden /></span>{label}</dt><dd className="mt-2 text-3xl font-medium tracking-tight tabular-nums text-forest">{pending ? <span className="sr-only">Loading</span> : value ?? 0}</dd></div>)}</dl></Panel>;
}
