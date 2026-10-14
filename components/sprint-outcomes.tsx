"use client";

import { ArrowUpRight, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { dateLabel } from "@/lib/cohort-dates";
import { outcomeLabels, type SprintData, type SprintOutcome } from "@/lib/sprint";
import { ActionButton, Badge } from "./ui";

export function SprintOutcomes({ data, onRecord, onEdit, onRemove, onActivity }: {
  data: SprintData; onRecord: () => void; onEdit: (outcome: SprintOutcome) => void; onRemove: (outcome: SprintOutcome) => void; onActivity: (id: string) => void;
}) {
  return <section aria-labelledby="sprint-outcomes-heading" className="space-y-5 border-t border-line pt-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="sprint-outcomes-heading" className="text-xl font-medium tracking-tight text-foreground">Sprint outcomes</h2><p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">What moved forward: conversations, feedback, and new opportunities.</p></div>
      {data.canPlan && data.outcomes.length ? <ActionButton appearance="secondary" onPress={onRecord}><Plus className="size-4" aria-hidden />Record outcome</ActionButton> : null}
    </div>
    {data.outcomes.length ? <div className="grid gap-4 @min-[760px]:grid-cols-2">
      {[...data.outcomes].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).map((outcome) => <article key={outcome._id} className="flex min-w-0 flex-col rounded-2xl border border-line p-5 wrap-anywhere">
        <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone="green">{outcomeLabels[outcome.type]}</Badge><span className="text-xs tabular-nums text-muted">{dateLabel(outcome.date, "MMM d")} · Count {outcome.quantity}</span></div>
        <h3 className="mt-4 text-lg leading-6 font-medium tracking-tight text-foreground">{outcome.title}</h3>
        {outcome.notes ? <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted">{outcome.notes}</p> : null}
        {outcome.activityId || data.canPlan ? <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4">
          {outcome.activityId ? <button onClick={() => onActivity(outcome.activityId!)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-medium text-forest underline-offset-4 hover:underline">View related activity<ArrowUpRight className="size-3.5" aria-hidden /></button> : null}
          {data.canPlan ? <div className="flex items-center gap-2"><button aria-label={`Edit outcome ${outcome.title}`} onClick={() => onEdit(outcome)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-soft px-3 text-xs font-medium text-foreground hover:bg-warm"><Pencil className="size-3.5" aria-hidden />Edit outcome</button><button aria-label={`Remove outcome ${outcome.title}`} onClick={() => onRemove(outcome)} className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-muted hover:bg-red-50 hover:text-red-700"><Trash2 className="size-3.5" aria-hidden /></button></div> : null}
        </div> : null}
      </article>)}
    </div> : <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-2xl bg-soft p-5 @min-[640px]:p-6">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-forest"><Trophy className="size-5" strokeWidth={1.6} aria-hidden /></span>
      <div className="min-w-0 flex-1 basis-52"><h3 className="text-base font-medium text-foreground">{data.canPlan ? "Small wins count, too" : "No outcomes recorded yet"}</h3><p className="mt-1 max-w-lg text-sm leading-6 text-muted">{data.canPlan ? "A useful conversation. Feedback that changed your thinking. Capture what came from taking part." : "Reported results will appear here as the Sprint unfolds."}</p></div>
      {data.canPlan ? <ActionButton appearance="secondary" onPress={onRecord}><Plus className="size-4" aria-hidden />Record outcome</ActionButton> : null}
    </div>}
    <p className="text-xs leading-5 text-muted">Outcomes are self-reported. They don’t change attendance or mission progress.</p>
  </section>;
}
