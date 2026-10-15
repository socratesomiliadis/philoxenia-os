import { z } from "zod";
import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { SF_TIMEZONE } from "./cohort-dates";
import { sfCalendarDate } from "./opportunities";
import type { MissionGoal } from "./mission";
import type { Opportunity } from "./opportunities";

export const activityKinds = ["task", "event", "meeting", "challenge"] as const;
export const activityLabels = { task: "Task", event: "Event", meeting: "Meeting", challenge: "Challenge" };
const timestamp = z.number().int().min(0).max(253402300799999);
export const activitySchema = z.object({
  kind: z.enum(activityKinds), title: z.string().trim().min(3, "Add a title with at least 3 characters.").max(160),
  notes: z.string().trim().max(3000), location: z.string().trim().max(200),
  day: z.iso.date().optional(), startAt: timestamp.optional(), endAt: timestamp.optional(),
}).superRefine((value, ctx) => {
  if ((value.startAt === undefined) !== (value.endAt === undefined)) ctx.addIssue({ code: "custom", message: "Set both a start and end time." });
  if (value.startAt !== undefined && value.endAt !== undefined && value.endAt <= value.startAt) ctx.addIssue({ code: "custom", message: "Set the end time after the start time." });
  if ((value.kind === "event" || value.kind === "meeting") && value.startAt === undefined) ctx.addIssue({ code: "custom", message: "Schedule a start and end time, or save an untimed task instead." });
  if (value.startAt !== undefined && value.day !== undefined) ctx.addIssue({ code: "custom", message: "Use a time range or an untimed day, not both." });
});
export const goalLinkSchema = z.object({ missionConfirmedAt: z.number(), index: z.number().int().min(0).max(2) });
export const progressSchema = z.object({ status: z.enum(["planned", "completed", "skipped"]), goalLink: goalLinkSchema.optional(), contribution: z.number().int().min(0).max(100) }).superRefine((value, ctx) => {
  if (value.contribution > 0 && (!value.goalLink || value.status !== "completed")) ctx.addIssue({ code: "custom", message: "Goal contributions require a linked goal and a completed activity." });
});
export const outcomeTypes = ["meeting", "feedback", "project", "internship", "funding", "other"] as const;
export const outcomeLabels = { meeting: "Meeting", feedback: "Feedback", project: "Project", internship: "Internship", funding: "Funding conversation", other: "Other result" };
export const outcomeSchema = z.object({ type: z.enum(outcomeTypes), title: z.string().trim().min(3, "Describe the result in at least 3 characters.").max(160), notes: z.string().trim().max(3000), date: z.iso.date(), quantity: z.number().int().min(1).max(100) });
export type ActivityInput = z.infer<typeof activitySchema>;
export type GoalLink = z.infer<typeof goalLinkSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type OutcomeInput = z.infer<typeof outcomeSchema>;
export type SprintProgress = ProgressInput & { revision: number; updatedAt: number; activityRevision: number; completedAt?: number };
export type SprintEntry = ActivityInput & {
  _id: string; scope: "personal" | "cohort"; revision: number; updatedAt: number; cancelledAt?: number;
  opportunityId?: string; sourceUrl?: string; sourceChanged?: boolean; sourceUnavailable?: boolean;
  progress: SprintProgress; calendarUid: string;
};
export type SprintOutcome = OutcomeInput & { _id: string; activityId?: string; updatedAt: number };
export type SprintData = { cohortId: string; cohortName: string; startDate: string; endDate: string; entries: SprintEntry[]; goals: MissionGoal[]; missionConfirmedAt?: number; outcomes: SprintOutcome[]; canPlan: boolean; readOnly: boolean; management: boolean; profileName?: string };
export const emptyProgress: SprintProgress = { status: "planned", contribution: 0, revision: 0, updatedAt: 0, activityRevision: 0 };
export type ActivitySave = { input: ActivityInput; entry?: SprintEntry; goalLink?: GoalLink; allowOverlap?: boolean; opportunity?: Opportunity };
export type SprintActions = {
  saveActivity: (args: ActivitySave) => Promise<void>;
  setProgress: (entry: SprintEntry, input: ProgressInput) => Promise<void>;
  removeActivity: (entry: SprintEntry) => Promise<void>;
  restoreActivity: (entry: SprintEntry) => Promise<void>;
  saveOutcome: (input: OutcomeInput, activityId?: string, outcome?: SprintOutcome) => Promise<void>;
  removeOutcome: (outcome: SprintOutcome) => Promise<void>;
};

export function activityFromOpportunity(opportunity: Opportunity): ActivityInput {
  const timed = opportunity.kind === "event" && opportunity.startAt !== undefined;
  return { title: timed ? opportunity.title : `Explore ${opportunity.title}`.slice(0, 160), kind: timed ? "event" : "task", notes: opportunity.summary,
    location: opportunity.location, ...(timed ? { startAt: opportunity.startAt, endAt: opportunity.endAt ?? opportunity.startAt! + 3_600_000 } : opportunity.eventDate ? { day: opportunity.eventDate } : {}) };
}

export function sprintDays(startDate: string, endDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new TZDate(year, month - 1, day, SF_TIMEZONE);
  const days: string[] = [];
  for (let i = 0; i < 366; i++) {
    const date = format(addDays(start, i), "yyyy-MM-dd");
    if (date > endDate) break;
    days.push(date);
  }
  return days;
}
export function activityDate(entry: ActivityInput) { return entry.startAt === undefined ? entry.day : sfCalendarDate(entry.startAt); }
export function activityOnDay(entry: ActivityInput, day: string) {
  return entry.startAt !== undefined && entry.endAt !== undefined ? sfCalendarDate(entry.startAt) <= day && sfCalendarDate(entry.endAt - 1) >= day : entry.day === day;
}
export function inStay(entry: ActivityInput, startDate: string, endDate: string) {
  if (entry.startAt !== undefined && entry.endAt !== undefined) return sfCalendarDate(entry.startAt) >= startDate && sfCalendarDate(entry.endAt - 1) <= endDate;
  return !entry.day || (entry.day >= startDate && entry.day <= endDate);
}
export function assertInStay(entry: ActivityInput, startDate: string, endDate: string) {
  if (!inStay(entry, startDate, endDate)) throw new Error(`Keep this activity between ${startDate} and ${endDate} (San Francisco time).`);
}
export function overlapping(input: ActivityInput, entries: SprintEntry[], excludeId?: string) {
  if (input.startAt === undefined || input.endAt === undefined) return [];
  return entries.filter((entry) => entry._id !== excludeId && !entry.cancelledAt && entry.progress.status !== "skipped" && entry.startAt !== undefined && entry.endAt !== undefined && input.startAt! < entry.endAt && input.endAt! > entry.startAt);
}
export function goalTotals(entries: SprintEntry[], confirmedAt?: number) {
  return [0, 1, 2].map((index) => entries.reduce((sum, entry) => sum + (!entry.cancelledAt && entry.progress.status === "completed" && confirmedAt !== undefined && entry.progress.goalLink?.missionConfirmedAt === confirmedAt && entry.progress.goalLink.index === index ? entry.progress.contribution : 0), 0));
}
