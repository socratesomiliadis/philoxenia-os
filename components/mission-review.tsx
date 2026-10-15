"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";

import { dateLabel } from "@/lib/cohort-dates";
import type { MissionGoal } from "@/lib/mission";
import { Field, TextareaField } from "./ui";

export function MissionReview({ goals, expanded, onExpand, onChange, disabled, startDate, endDate }: {
  goals: MissionGoal[]; expanded: number | null; onExpand: (index: number | null) => void;
  onChange: (index: number, patch: Partial<MissionGoal>) => void; disabled: boolean; startDate: string; endDate: string;
}) {
  return <Accordion aria-label="Mission goals" value={expanded === null ? [] : [`goal-${expanded}`]} onValueChange={(keys) => { const key = keys[0]; onExpand(key === undefined ? null : Number(String(key).slice(5))); }} className="@container/mission space-y-3">{goals.map((goal, index) => <AccordionItem key={index} value={`goal-${index}`} disabled={disabled} className="rounded-2xl border border-line bg-white">
      <AccordionTrigger aria-label={`Edit goal ${index + 1}: ${goal.title}`} className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-4 py-4 text-start outline-offset-4 hover:bg-soft/40 focus-visible:outline-2 focus-visible:outline-forest">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-medium tabular-nums text-forest">{index + 1}</span>
        <span className="min-w-0 flex-1"><span className="block text-base leading-6 font-medium wrap-anywhere text-foreground">{goal.title || "Name this goal"}</span><span className="mt-1 block text-sm leading-6 font-normal wrap-anywhere text-muted-foreground">{goal.target} {goal.metric.replace(/^number of\s+/i, "")}</span><span className="mt-1.5 block text-xs leading-5 font-normal text-muted-foreground">{goal.deadline ? `By ${dateLabel(goal.deadline, "MMM d")}` : "Choose a deadline"}</span></span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-1"><fieldset disabled={disabled} className="min-w-0 space-y-4 border-t border-line pb-4 pt-4"><legend className="sr-only">Edit goal {index + 1}</legend>
        <Field label="Title" value={goal.title} maxLength={100} onChange={(event) => onChange(index, { title: event.target.value })} />
        <div className="grid gap-4 @min-[440px]/mission:grid-cols-[100px_minmax(0,1fr)]"><Field label="How many" type="number" min={1} max={100} value={String(goal.target)} onChange={(event) => onChange(index, { target: Number(event.target.value) })} /><Field label="What counts" value={goal.metric} maxLength={160} onChange={(event) => onChange(index, { metric: event.target.value })} /></div>
        <Field label="Deadline" type="date" min={startDate} max={endDate} value={goal.deadline} onChange={(event) => onChange(index, { deadline: event.target.value })} />
        <TextareaField label="First actions" value={goal.firstActions.join("\n")} onChange={(event) => onChange(index, { firstActions: event.target.value.split("\n") })} description="One to three actions, each on its own line. Up to 240 characters per action." rows={4} maxLength={722} className="w-full resize-y rounded-xl border border-line bg-white p-3 text-sm leading-7 focus:border-forest focus:ring-2 focus:ring-forest/10" />
      </fieldset></AccordionContent>
  </AccordionItem>)}</Accordion>;
}
