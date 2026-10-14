"use client";

import { Accordion, Label, TextArea, TextField } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { dateLabel } from "@/lib/cohort-dates";
import type { MissionGoal } from "@/lib/mission";
import { Field } from "./ui";

export function MissionReview({ goals, expanded, onExpand, onChange, disabled, startDate, endDate }: {
  goals: MissionGoal[]; expanded: number | null; onExpand: (index: number | null) => void;
  onChange: (index: number, patch: Partial<MissionGoal>) => void; disabled: boolean; startDate: string; endDate: string;
}) {
  return <Accordion aria-label="Mission goals" expandedKeys={new Set(expanded === null ? [] : [`goal-${expanded}`])} onExpandedChange={(keys) => { const key = keys.values().next().value; onExpand(key === undefined ? null : Number(String(key).slice(5))); }} hideSeparator className="divide-y divide-line">{goals.map((goal, index) => <Accordion.Item key={index} id={`goal-${index}`} isDisabled={disabled}>
      <Accordion.Heading><Accordion.Trigger aria-label={`Edit goal ${index + 1}: ${goal.title}`} className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-0 py-4 text-start outline-offset-4 hover:bg-soft/40 focus-visible:outline-2 focus-visible:outline-forest">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-medium tabular-nums text-forest">{index + 1}</span>
        <span className="min-w-0 flex-1"><span className="block text-base leading-6 font-medium wrap-anywhere text-foreground">{goal.title || "Name this goal"}</span><span className="mt-1 block text-sm leading-6 font-normal wrap-anywhere text-muted">{goal.target} {goal.metric.replace(/^number of\s+/i, "")}</span><span className="mt-1.5 block text-xs leading-5 font-normal text-muted">{goal.deadline ? `By ${dateLabel(goal.deadline, "MMM d")}` : "Choose a deadline"}</span></span>
        <ChevronDown className={`mt-1 size-4 shrink-0 text-muted ${expanded === index ? "rotate-180" : ""}`} aria-hidden />
      </Accordion.Trigger></Accordion.Heading>
      <Accordion.Panel><Accordion.Body className="p-0"><fieldset disabled={disabled} className="min-w-0 space-y-5 pb-6 pt-1"><legend className="sr-only">Edit goal {index + 1}</legend>
        <Field label="Title" value={goal.title} maxLength={100} onChange={(event) => onChange(index, { title: event.target.value })} />
        <div className="grid gap-4 sm:grid-cols-[100px_minmax(0,1fr)]"><Field label="How many" type="number" min={1} max={100} value={String(goal.target)} onChange={(event) => onChange(index, { target: Number(event.target.value) })} /><Field label="What counts" value={goal.metric} maxLength={160} onChange={(event) => onChange(index, { metric: event.target.value })} /></div>
        <Field label="Deadline" type="date" min={startDate} max={endDate} value={goal.deadline} onChange={(event) => onChange(index, { deadline: event.target.value })} />
        <TextField value={goal.firstActions.join("\n")} onChange={(value) => onChange(index, { firstActions: value.split("\n") })} className="space-y-2"><Label className="text-sm font-medium">First actions</Label><TextArea rows={4} maxLength={722} className="w-full resize-y rounded-xl border border-line bg-white p-3 text-sm leading-7 focus:border-forest focus:ring-2 focus:ring-forest/10" /><p className="text-xs leading-5 font-normal text-muted">One to three actions, each on its own line. Up to 240 characters per action.</p></TextField>
      </fieldset></Accordion.Body></Accordion.Panel>
  </Accordion.Item>)}</Accordion>;
}
