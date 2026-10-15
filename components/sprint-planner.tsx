"use client";

import Link from "next/link";
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, Clock3, Download, List, MoveHorizontal, Plus, Trophy } from "lucide-react";
import { activityOnDay, type SprintData, type SprintEntry } from "@/lib/sprint";
import { dateLabel, dateRangeLabel } from "@/lib/cohort-dates";
import { ActionButton } from "./ui";
import { SprintEntryCard } from "./sprint-agenda";

export function SprintHeader({ data, sharedOnly, onAdd, onExport }: { data: SprintData; sharedOnly: boolean; onAdd: () => void; onExport: () => void }) {
  return <header className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
      <div className="min-w-0">
        <h1 className="text-3xl leading-tight font-medium tracking-[-0.045em] text-foreground @min-[640px]:text-[38px]">
          {data.management || sharedOnly ? "Cohort Sprint" : data.readOnly ? `${data.profileName ?? "Participant"}’s Sprint` : "Your 14-day Sprint"}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {data.canPlan ? <ActionButton onClick={onAdd}><Plus className="size-4" aria-hidden />{data.management ? "Add cohort activity" : "Add activity"}</ActionButton> : null}
        {sharedOnly ? <Link href="/organizer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-medium text-white shadow-control transition-[background-color,transform] duration-150 ease-ui hover:bg-forest/90 active:scale-[0.98]">Manage cohort activities</Link> : null}
        <ActionButton appearance="secondary" onClick={onExport} disabled={!data.entries.some((entry) => !entry.cancelledAt && entry.progress.status !== "skipped")}><Download className="size-4" aria-hidden />Export Sprint</ActionButton>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs leading-5 text-muted-foreground">
      <span className="rounded-md bg-sage px-2.5 py-1 font-medium text-forest wrap-anywhere">{data.cohortName}</span>
      <span className="inline-flex items-center gap-2 tabular-nums"><CalendarDays className="size-3.5 shrink-0" aria-hidden />{dateRangeLabel(data.startDate, data.endDate)}</span>
      <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden />San Francisco time</span>
    </div>
  </header>;
}

export function SprintSummary({ entries, outcomes }: { entries: SprintEntry[]; outcomes: SprintData["outcomes"] }) {
  const stats = [
    { label: "Planned", count: entries.filter((entry) => entry.progress.status === "planned").length, icon: CalendarDays },
    { label: "Completed", count: entries.filter((entry) => entry.progress.status === "completed").length, icon: CheckCheck },
    { label: "Outcomes", count: outcomes.reduce((sum, item) => sum + item.quantity, 0), icon: Trophy },
  ];
  return <dl aria-label="Sprint overview" className="grid grid-cols-3 gap-x-3 gap-y-5 rounded-2xl bg-soft px-4 py-5 @min-[640px]:px-6">
    {stats.map(({ label, count, icon: Icon }) => <div key={label} className="flex min-w-0 flex-col gap-2 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:gap-3">
      <Icon className="hidden size-4 shrink-0 text-muted-foreground @min-[640px]:block" strokeWidth={1.6} aria-hidden />
      <dt className="text-xs leading-5 text-muted-foreground @min-[640px]:text-sm">{label}</dt>
      <dd className="text-2xl leading-none font-medium tracking-tight tabular-nums text-forest @min-[640px]:ms-auto @min-[640px]:me-5">{count}</dd>
    </div>)}
  </dl>;
}

export function SprintDayPicker({ days, entries, selectedDay, view, onDay, onView }: {
  days: string[]; entries: SprintEntry[]; selectedDay: string; view: "day" | "agenda"; onDay: (day: string) => void; onView: (view: "day" | "agenda") => void;
}) {
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));
  return <section aria-label="Sprint days" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-medium tracking-tight text-foreground">Your two weeks</h2>
      <div role="group" aria-label="Schedule view" className="inline-flex rounded-xl bg-soft p-1">
        {[{ value: "day", label: "Day view", icon: CalendarDays }, { value: "agenda", label: "Full agenda", icon: List }].map(({ value, label, icon: Icon }) => <button key={value} aria-pressed={view === value} onClick={() => onView(value as typeof view)} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors duration-150 ${view === value ? "bg-white text-forest shadow-control" : "text-muted-foreground hover:text-foreground"}`}><Icon className="hidden size-3.5 @min-[640px]:block" aria-hidden />{label}</button>)}
      </div>
    </div>
    <div className="grid min-w-0 gap-5 @min-[760px]:grid-cols-2 @min-[760px]:gap-6">
      {weeks.map((week, weekIndex) => <div key={week[0]} className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs leading-5"><span className="font-medium text-foreground">Week {weekIndex + 1}</span><span className="tabular-nums text-muted-foreground">{dateLabel(week[0], "MMM d")} – {dateLabel(week.at(-1)!, "MMM d")}</span></div>
        <div className="overflow-x-auto rounded-xl pb-1 [scrollbar-width:thin]">
          <div className="grid min-w-[350px] grid-cols-7 gap-1.5">
            {week.map((date, index) => {
              const active = view === "day" && selectedDay === date;
              const count = entries.filter((entry) => activityOnDay(entry, date)).length;
              return <button key={date} aria-label={`Day ${weekIndex * 7 + index + 1}, ${dateLabel(date, "MMM d")}`} aria-pressed={active} aria-describedby={count ? `sprint-day-${date}-count` : undefined} onClick={() => onDay(date)} className={`flex min-h-[88px] min-w-11 flex-col items-center justify-center gap-1.5 rounded-xl border py-3 tabular-nums transition-colors duration-150 ${active ? "border-forest bg-forest text-white" : "border-transparent bg-soft text-muted-foreground hover:border-line hover:bg-warm"}`}>
                <span className={`text-[11px] leading-4 ${active ? "text-white/75" : "text-muted-foreground"}`}>{dateLabel(date, "EEE")}</span>
                <span className={`text-xl leading-6 font-medium tracking-tight ${active ? "text-white" : "text-foreground"}`}>{dateLabel(date, "d")}</span>
                <span className={`size-1 rounded-full ${count ? active ? "bg-white" : "bg-forest" : "bg-transparent"}`} aria-hidden />
                {count ? <span id={`sprint-day-${date}-count`} className="sr-only">{count} scheduled {count === 1 ? "activity" : "activities"}</span> : null}
              </button>;
            })}
          </div>
        </div>
      </div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="size-1 rounded-full bg-forest" aria-hidden />Activity scheduled</span>
      <span className="inline-flex items-center gap-1.5 @min-[400px]:hidden"><MoveHorizontal className="size-3.5" aria-hidden />Scroll to see all days</span>
    </div>
  </section>;
}

export function SprintDaySchedule({ date, items, dayIndex, days, data, preview, fullAgenda, onDay, onAdd, onOpen }: {
  date: string; items: SprintEntry[]; dayIndex: number; days: string[]; data: SprintData; preview: boolean; fullAgenda: boolean; onDay: (date: string) => void; onAdd: () => void; onOpen: (entry: SprintEntry) => void;
}) {
  return <section aria-label={`Agenda for ${dateLabel(date, "MMM d")}`} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="mb-1 text-xs leading-5 text-muted-foreground">Day {dayIndex + 1} of {days.length}{items.length ? ` · ${items.length} ${items.length === 1 ? "activity" : "activities"}` : ""}</p>
        <h2 className="text-xl leading-7 font-medium tracking-tight text-foreground @min-[640px]:text-2xl">{dateLabel(date, "EEEE, MMM d")}</h2>
      </div>
      <div className="flex items-center gap-2">
        {!fullAgenda ? <div role="group" aria-label="Change day" className="flex items-center gap-1">
          <button aria-label="Previous day" disabled={dayIndex === 0} onClick={() => onDay(days[dayIndex - 1])} className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-muted-foreground transition-colors hover:bg-soft disabled:opacity-35"><ChevronLeft className="size-4 rtl:rotate-180" aria-hidden /></button>
          <button aria-label="Next day" disabled={dayIndex === days.length - 1} onClick={() => onDay(days[dayIndex + 1])} className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-muted-foreground transition-colors hover:bg-soft disabled:opacity-35"><ChevronRight className="size-4 rtl:rotate-180" aria-hidden /></button>
        </div> : null}
        {data.canPlan && items.length ? <button aria-label={`Add activity on ${dateLabel(date, "MMM d")}`} onClick={onAdd} className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-forest transition-colors hover:bg-sage"><Plus className="size-4" aria-hidden /></button> : null}
      </div>
    </div>
    {items.length ? <div className="space-y-3">{items.map((entry) => <SprintEntryCard key={entry._id} entry={entry} onOpen={() => onOpen(entry)} />)}</div> : fullAgenda ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft px-4 py-3"><p className="text-sm text-muted-foreground">No activities scheduled.</p>{data.canPlan ? <button aria-label={`Add activity on ${dateLabel(date, "MMM d")}`} onClick={onAdd} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-forest hover:bg-sage"><Plus className="size-4" aria-hidden />Plan this day</button> : null}</div> : <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-soft/50 px-5 py-9 text-center">
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl border border-line bg-white text-forest"><CalendarDays className="size-5" strokeWidth={1.6} aria-hidden /></span>
      <h3 className="text-base font-medium text-foreground">{data.canPlan ? "A little room for possibility" : "No activities scheduled"}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{data.canPlan ? data.management ? "Add a shared activity or challenge for the cohort." : "Make a plan for this day, or find something worth showing up for." : data.readOnly ? "This participant hasn’t planned anything for this day." : "Add shared activities from the Command Center to start filling the cohort’s schedule."}</p>
      {data.canPlan ? <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"><ActionButton appearance="secondary" aria-label={`Add activity on ${dateLabel(date, "MMM d")}`} onClick={onAdd}><Plus className="size-4" aria-hidden />Plan this day</ActionButton>{!data.management ? <Link href={preview ? "/preview/opportunities" : "/opportunities"} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-forest underline-offset-4 hover:underline">Find opportunities</Link> : null}</div> : null}
    </div>}
  </section>;
}
