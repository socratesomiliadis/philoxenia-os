import { z } from "zod";
import { dateLabel } from "./cohort-dates";

export const industries = ["AI & machine learning", "Developer tools", "Climate & energy", "Health & biotech", "Fintech", "Consumer & community", "Education", "Robotics & hardware", "Creative tools", "Other"];

export const draftAnswersSchema = z.object({
  building: z.string().max(1200),
  outcomes: z.string().max(1200),
  industries: z.array(z.string().trim().min(1).max(80)).max(8),
  offering: z.string().max(1200),
});
export const answersSchema = draftAnswersSchema.extend({
  building: z.string().trim().min(10, "Tell us what you’re building in at least 10 characters.").max(1200),
  outcomes: z.string().trim().min(10, "Describe what you want from SF in at least 10 characters.").max(1200),
  industries: z.array(z.string().trim().min(1).max(80)).min(1, "Choose at least one industry.").max(8),
  offering: z.string().trim().min(5, "Add a skill or a way you can help in at least 5 characters.").max(1200),
});
export const goalSchema = z.object({
  title: z.string().trim().min(3).max(100),
  target: z.number().int().min(1).max(100),
  metric: z.string().trim().min(3).max(160),
  deadline: z.iso.date(),
  firstActions: z.array(z.string().trim().min(3).max(240)).min(1).max(3),
});
export const missionSchema = z.object({ goals: z.array(goalSchema).length(3) });
export type OnboardingAnswers = z.infer<typeof draftAnswersSchema>;
export type MissionGoal = z.infer<typeof goalSchema>;
export const emptyAnswers: OnboardingAnswers = { building: "", outcomes: "", industries: [], offering: "" };

export function validateGoals(goals: unknown, startDate: string, endDate: string) {
  const parsed = missionSchema.parse({ goals }).goals;
  if (parsed.some((goal) => goal.deadline < startDate || goal.deadline > endDate)) {
    throw new Error(`Set every deadline between ${dateLabel(startDate)} and ${dateLabel(endDate)}.`);
  }
  return parsed;
}

export function templateGoals(answers: OnboardingAnswers, startDate: string, endDate: string): MissionGoal[] {
  const interest = answers.industries[0] || "your field";
  return [
    { title: "Test what you’re building", target: 3, metric: "feedback conversations with potential users", deadline: endDate, firstActions: ["Write a two-sentence description of what you’re building.", "Ask one potential user for 15 minutes of feedback."] },
    { title: "Find your people", target: 2, metric: `events or meetups in ${interest}`, deadline: endDate, firstActions: [`Find a relevant SF event between ${dateLabel(startDate)} and ${dateLabel(endDate)}.`, "Prepare one question to ask someone you meet."] },
    { title: "Give something back", target: 2, metric: "people supported with your skills", deadline: endDate, firstActions: ["Turn a skill you can offer into a specific 30-minute session.", "Offer that session to someone in your cohort."] },
  ];
}

// Free text may contain contact details even though identity fields are excluded.
export function missionPrompt(answers: OnboardingAnswers, startDate: string, endDate: string) {
  const redact = (value: string) => value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/https?:\/\/\S+/gi, "[link removed]")
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[phone removed]");
  return JSON.stringify({
    building: redact(answers.building), outcomes: redact(answers.outcomes),
    industries: answers.industries.map(redact), offering: redact(answers.offering),
    startDate, endDate,
  });
}
