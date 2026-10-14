import { templateGoals } from "./mission";
import { parseSfDateTime } from "./opportunities";
import { activitySchema, assertInStay, emptyProgress, overlapping, outcomeSchema, progressSchema, type SprintActions, type SprintData, type SprintEntry } from "./sprint";

const makeEntry = (id: string, input: Partial<SprintEntry>): SprintEntry => ({ _id: id, kind: "task", scope: "personal", title: "Sample task", notes: "Illustrative sample activity.", location: "", revision: 1, updatedAt: 1, progress: { ...emptyProgress }, calendarUid: `${id}.sample@philoxenia.hustlehours.com`, ...input });
export const sampleSprintData: SprintData = {
  cohortId: "preview-cohort", cohortName: "Cohort 01 · The first chapter", startDate: "2026-11-02", endDate: "2026-11-15", canPlan: true, readOnly: false, management: false, missionConfirmedAt: 1,
  goals: templateGoals({ building: "A tool for independent builders.", outcomes: "Meet founders and get product feedback.", industries: ["Developer tools"], offering: "Product reviews and prototypes." }, "2026-11-02", "2026-11-15"),
  entries: [
    makeEntry("sample-welcome", { title: "Welcome to your two weeks", kind: "meeting", scope: "cohort", notes: "Meet the cohort, share what you’re building, and choose a first step. Illustrative sample.", location: "San Francisco · sample venue", startAt: parseSfDateTime("2026-11-02T10:00"), endAt: parseSfDateTime("2026-11-02T11:00") }),
    makeEntry("sample-pitch", { title: "Prepare a two-minute product story", day: "2026-11-02", notes: "What are you building, who is it for, and what do you want to learn?", progress: { ...emptyProgress, goalLink: { missionConfirmedAt: 1, index: 0 } } }),
    makeEntry("sample-meeting", { title: "Prototype feedback with a fellow builder", kind: "meeting", location: "San Francisco · sample café", startAt: parseSfDateTime("2026-11-03T15:00"), endAt: parseSfDateTime("2026-11-03T15:30"), progress: { ...emptyProgress, goalLink: { missionConfirmedAt: 1, index: 0 } } }),
    makeEntry("sample-challenge", { title: "Ask someone a better question", kind: "challenge", scope: "cohort", day: "2026-11-04", notes: "Ask a builder what they learned from a recent product decision. Write down one useful insight." }),
    makeEntry("sample-thanks", { title: "Offer a skill to someone in the cohort", notes: "Choose one way you can help and make a specific offer.", progress: { ...emptyProgress, goalLink: { missionConfirmedAt: 1, index: 2 } } }),
  ], outcomes: [],
};

const storageKey = "philoxenia.sample-sprint.v1";
let current = sampleSprintData;
let initialized = false;
const listeners = new Set<() => void>();
export function subscribeSampleSprint(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getServerSampleSprint() { return sampleSprintData; }
export function getSampleSprint(): SprintData {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (value?.version === 1 && Array.isArray(value.entries) && Array.isArray(value.outcomes)
        && value.entries.every((item: SprintEntry) => typeof item._id === "string" && activitySchema.safeParse(item).success && progressSchema.safeParse(item.progress).success && Number.isFinite(item.updatedAt) && Number.isFinite(item.revision) && typeof item.calendarUid === "string")
        && value.outcomes.every((item: { _id: string }) => typeof item._id === "string" && outcomeSchema.safeParse(item).success)) current = { ...sampleSprintData, entries: value.entries, outcomes: value.outcomes };
    } catch { /* An unavailable or outdated sample store starts fresh. */ }
  }
  return current;
}
function update(data: SprintData) {
  current = data;
  try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, entries: data.entries, outcomes: data.outcomes })); } catch { /* The sample still works in memory. */ }
  listeners.forEach((listener) => listener());
}
export function resetSampleSprint() { update(sampleSprintData); }
export const sampleSprintActions: SprintActions = {
  async saveActivity({ input, entry, goalLink, allowOverlap, opportunity }) {
    const data = getSampleSprint();
    input = activitySchema.parse(input); assertInStay(input, data.startDate, data.endDate);
    if (opportunity && data.entries.some((item) => item.opportunityId === opportunity._id)) throw new Error("This opportunity is already in your Sprint. Edit the existing activity instead.");
    if (overlapping(input, data.entries, entry?._id).length && !allowOverlap) throw new Error("Review the overlapping time before saving.");
    const id = entry?._id ?? `sample-${crypto.randomUUID()}`;
    const revision = (entry?.revision ?? 0) + 1;
    const sameGoal = JSON.stringify(entry?.progress.goalLink) === JSON.stringify(goalLink);
    const next: SprintEntry = { ...entry, ...input, day: input.day, startAt: input.startAt, endAt: input.endAt, _id: id, scope: "personal", revision, updatedAt: Date.now(), calendarUid: `${id}.sample@philoxenia.hustlehours.com`,
      ...(opportunity ? { opportunityId: opportunity._id, sourceUrl: opportunity.sourceUrl } : {}),
      progress: { ...entry?.progress ?? emptyProgress, goalLink, contribution: sameGoal ? entry?.progress.contribution ?? 0 : 0, activityRevision: revision, revision: (entry?.progress.revision ?? 0) + 1, updatedAt: Date.now() } };
    update({ ...data, entries: [...data.entries.filter((item) => item._id !== id), next] });
  },
  async setProgress(entry, input) {
    const data = getSampleSprint();
    input = progressSchema.parse(input);
    update({ ...data, entries: data.entries.map((item) => item._id === entry._id ? { ...item, progress: { ...item.progress, ...input, goalLink: input.goalLink, revision: item.progress.revision + 1, activityRevision: item.revision, updatedAt: Date.now(), completedAt: input.status === "completed" ? item.progress.completedAt ?? Date.now() : undefined } } : item) });
  },
  async removeActivity(entry) {
    const data = getSampleSprint();
    update({ ...data, entries: entry.scope === "cohort" ? data.entries.map((item) => item._id === entry._id ? { ...item, cancelledAt: Date.now(), revision: item.revision + 1 } : item) : data.entries.filter((item) => item._id !== entry._id), outcomes: data.outcomes.map((item) => entry.scope === "personal" && item.activityId === entry._id ? { ...item, activityId: undefined } : item) });
  },
  async restoreActivity(entry) { const data = getSampleSprint(); update({ ...data, entries: data.entries.map((item) => item._id === entry._id ? { ...item, cancelledAt: undefined, revision: item.revision + 1 } : item) }); },
  async saveOutcome(input, activityId, outcome) {
    const data = getSampleSprint();
    const next = { ...outcomeSchema.parse(input), _id: outcome?._id ?? `sample-outcome-${crypto.randomUUID()}`, activityId, updatedAt: Date.now() };
    update({ ...data, outcomes: [...data.outcomes.filter((item) => item._id !== next._id), next] });
  },
  async removeOutcome(outcome) { const data = getSampleSprint(); update({ ...data, outcomes: data.outcomes.filter((item) => item._id !== outcome._id) }); },
};
