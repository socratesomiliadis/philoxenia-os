"use client";

import { CalendarDays } from "lucide-react";
import { dateLabel } from "@/lib/cohort-dates";
import type { MissionGoal } from "@/lib/mission";

export function MissionGoals({ goals }: { goals: MissionGoal[] }) {
  return <ol className="space-y-5">{goals.map((goal, index) => <li key={index} className="flex min-w-0 gap-3">
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-medium tabular-nums text-forest">{index + 1}</span>
    <div className="min-w-0"><h3 className="text-sm font-medium wrap-anywhere text-foreground">{goal.title}</h3><p className="mt-1 text-sm wrap-anywhere text-muted">{goal.target} {goal.metric}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="size-3.5" aria-hidden />By {dateLabel(goal.deadline, "MMM d")}</p></div>
  </li>)}</ol>;
}
