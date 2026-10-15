import type { MissionGoal } from "./mission";

export const UNANSWERED_REQUEST_MS = 48 * 60 * 60 * 1000;
export type AttentionFlag = { kind: "help" | "onboarding" | "request" | "goal"; reason: string };

export function attentionFlags(input: {
  help?: string; confirmed: boolean; completedCohort: boolean; today: string;
  goals: MissionGoal[]; totals: number[]; unansweredRequests: number;
}): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  if (input.help) flags.push({ kind: "help", reason: "Participant explicitly asked for help." });
  if (!input.confirmed && !input.completedCohort) flags.push({ kind: "onboarding", reason: "No confirmed mission for this cohort; onboarding is incomplete." });
  if (input.unansweredRequests) flags.push({ kind: "request", reason: `${input.unansweredRequests} support request(s) awaiting an alumnus response for at least 48 hours.` });
  input.goals.forEach((goal, index) => {
    if (goal.deadline < input.today && (input.totals[index] ?? 0) < goal.target) flags.push({ kind: "goal", reason: `“${goal.title}” was due ${goal.deadline}; ${input.totals[index] ?? 0}/${goal.target} recorded toward its target.` });
  });
  return flags;
}

// Quote every field and neutralize spreadsheet formulas, including after whitespace.
// Exports never evaluate participant-provided titles, names or notes as formulas.
export function csvFile(headers: string[], rows: (string | number | undefined | null)[][]) {
  const field = (value: string | number | undefined | null) => {
    const text = String(value ?? "");
    const safe = /^[\s\uFEFF]*[=+@\-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(field).join(",")).join("\r\n") + "\r\n";
}
