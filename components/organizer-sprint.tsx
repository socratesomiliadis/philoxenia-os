"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { Cohort } from "./workspace-context";
import { useWorkspace } from "./workspace-context";
import { ActionButton, Panel } from "./ui";
import { SprintModal } from "./sprint-editors";
import { SprintDashboard } from "./sprint-dashboard";

export function OrganizerSprint({ cohort, compact = false }: { cohort?: Cohort; compact?: boolean }) {
  const { preview } = useWorkspace();
  const [open, setOpen] = useState(false);
  const action = <ActionButton appearance="secondary" disabled={preview || !cohort} onClick={() => setOpen(true)}><CalendarDays className="size-4" aria-hidden />Manage cohort Sprint</ActionButton>;
  return <>{compact ? action : <Panel className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-xl font-medium tracking-tight text-foreground">Cohort Sprint</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Add shared activities and challenges. Hustlers record their own progress.</p></div>{action}</div></Panel>}{open && cohort ? <SprintModal title="Manage cohort Sprint" wide onClose={() => setOpen(false)}><SprintDashboard cohortId={cohort._id} management /></SprintModal> : null}</>;
}
