import type { FunctionReturnType } from "convex/server";
import type { api } from "../convex/_generated/api";
import { csvFile } from "./command-center";
import { sfCalendarDate } from "./opportunities";

export type CohortReportData = FunctionReturnType<typeof api.commandCenter.cohortSummary>;
export const exportKinds = ["summary", "goals", "activities", "outcomes"] as const;
export function cohortCsv(report: CohortReportData, kind: typeof exportKinds[number]) {
  const rows = report.participants, cohort = report.cohort.name;
  const iso = (value?: number) => value === undefined ? "" : new Date(value).toISOString();
  switch (kind) {
    case "summary": return csvFile(["Cohort", "Name", "Email", "Membership", "Suspended", "Alumni", "Arrival", "Departure", "Mission", "Attention reasons", "Planned meetings", "Marked completed", "Self-reported outcome records"], rows.map((p) => [cohort, p.name, p.email, p.membershipStatus, String(p.suspended), String(p.alumni), p.startDate, p.endDate, p.confirmedAt === undefined ? "Incomplete" : "Confirmed", p.flags.map((f) => f.reason).join(" | "), p.entries.filter((a) => a.kind === "meeting" && a.startAt !== undefined && a.status === "planned").length, p.entries.filter((a) => a.status === "completed").length, p.outcomes.length]));
    case "goals": return csvFile(["Cohort", "Name", "Email", "Goal", "Target", "Measure", "Deadline (SF)", "Recorded contribution", "Mission confirmed (UTC)"], rows.flatMap((p) => p.goals.map((g, i) => [cohort, p.name, p.email, g.title, g.target, g.metric, g.deadline, p.totals[i], iso(p.confirmedAt)])));
    case "activities": return csvFile(["Cohort", "Name", "Email", "Activity", "Kind", "Scope", "Date (SF)", "Start (UTC)", "End (UTC)", "Participant-marked status"], rows.flatMap((p) => p.entries.map((a) => [cohort, p.name, p.email, a.title, a.kind, a.scope, a.startAt === undefined ? a.day : sfCalendarDate(a.startAt), iso(a.startAt), iso(a.endAt), a.status])));
    case "outcomes": return csvFile(["Cohort", "Name", "Email", "Self-reported result", "Type", "Date (SF)", "Quantity", "Activity ID", "Evidence status"], rows.flatMap((p) => p.outcomes.map((o) => [cohort, p.name, p.email, o.title, o.type, o.date, o.quantity, o.activityId, "Self-reported; unverified"])));
  }
}
