"use client";

import { CalendarDays } from "lucide-react";
import { dateLabel } from "@/lib/cohort-dates";
import type { MissionGoal } from "@/lib/mission";

export function MissionGoals({ goals, showActions = false, layout = "list" }: { goals: MissionGoal[]; showActions?: boolean; layout?: "list" | "overview" }) {
  return <ol className={layout === "overview" ? "grid gap-3 @min-[760px]:grid-cols-3" : "space-y-3"}>{goals.map((goal, index) => <li key={index} className="flex min-w-0 gap-3 rounded-xl bg-soft/70 p-3.5">
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-medium tabular-nums text-forest">{index + 1}</span>
    <div className="min-w-0"><h3 className="text-sm leading-5 font-medium wrap-anywhere text-foreground">{goal.title}</h3><p className="mt-1 text-xs leading-5 wrap-anywhere text-muted-foreground"><span className="font-medium tabular-nums text-forest">{goal.target}</span> {goal.metric}</p><p className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" aria-hidden />By {dateLabel(goal.deadline, "MMM d")}</p>{showActions ? <ul className="mt-3 list-disc space-y-1 ps-4 text-sm leading-6 text-muted-foreground wrap-anywhere">{goal.firstActions.map((action, index) => <li key={index}>{action}</li>)}</ul> : null}</div>
  </li>)}</ol>;
}
