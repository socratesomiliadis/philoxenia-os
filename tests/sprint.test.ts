import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import type { FunctionArgs } from "convex/server";
import schema from "../convex/schema";
import { api, components } from "../convex/_generated/api";
import { activityOnDay, activitySchema, goalTotals, inStay, sprintDays, type ActivityInput } from "../lib/sprint";
import { parseSfDateTime } from "../lib/opportunities";
import { initialOccurrence, parseSprintTime, sfTimeCandidates } from "../lib/sprint-time";
import { sprintCalendar } from "../lib/sprint-calendar";
import { sampleSprintData } from "../lib/sample-sprint";
import { templateGoals } from "../lib/mission";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const task: ActivityInput = { kind: "task", title: "Review a prototype", notes: "Bring one question.", location: "", day: "2026-11-03" };
const meeting: ActivityInput = { ...task, kind: "meeting", day: undefined, startAt: parseSfDateTime("2026-11-03T15:00"), endAt: parseSfDateTime("2026-11-03T16:00") };
const answers = { building: "A tool for independent developers.", outcomes: "Get feedback on a prototype and meet builders.", industries: ["Developer tools"], offering: "Product reviews and React prototypes." };

async function setup() {
  vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com");
  const t = convexTest(schema, modules); betterAuthTest.register(t);
  async function identity(email: string, emailVerified = true) {
    const now = Date.now();
    const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email, name: email.split("@")[0], emailVerified, createdAt: now, updatedAt: now } } });
    const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 86_400_000, createdAt: now, updatedAt: now } } });
    return t.withIdentity({ subject: user._id, sessionId: session._id });
  }
  const organizer = await identity("organizer@example.com"); await organizer.mutation(api.users.ensureProfile, {});
  const cohortId = await organizer.mutation(api.cohorts.create, { name: "First chapter", description: "", startDate: "2026-10-25" });
  const otherCohort = await organizer.mutation(api.cohorts.create, { name: "Second chapter", description: "", startDate: "2027-03-07" });
  async function participant(email: string) {
    await organizer.mutation(api.invitations.invite, { cohortId, email, name: "" });
    const client = await identity(email); const profile = (await client.mutation(api.users.ensureProfile, {}))!;
    return { client, profile };
  }
  const { client: hustler, profile } = await participant("hustler@example.com");
  const create = (input: ActivityInput = task, extra: Partial<FunctionArgs<typeof api.sprint.saveActivity>> = {}) => hustler.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", expectedRevision: 0, expectedProgressRevision: 0, input, ...extra });
  const get = () => hustler.query(api.sprint.get, { cohortId });
  async function mission() {
    const current = await hustler.query(api.onboarding.get, { cohortId });
    if (!current) await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers, step: 4 });
    const proposal = await hustler.mutation(api.onboarding.useTemplates, { cohortId });
    await hustler.mutation(api.onboarding.saveProposal, { cohortId, goals: templateGoals(answers, "2026-10-25", "2026-11-07"), expectedRevision: proposal.revision, confirm: true });
    return (await get()).missionConfirmedAt!;
  }
  return { t, identity, organizer, hustler, profile, cohortId, otherCohort, participant, create, get, mission };
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Stage 4 Sprint", () => {
  it("protects private schedules and outcomes, and authorizes reads and writes for verified active members", async () => {
    const { t, identity, organizer, hustler, profile, cohortId, otherCohort, participant, create, get } = await setup();
    const id = await create();
    const other = await participant("other@example.com");
    expect((await other.client.query(api.sprint.get, { cohortId })).entries).toHaveLength(0);
    await expect(other.client.query(api.sprint.get, { cohortId, profileId: profile._id })).rejects.toThrow("own Sprint");
    expect((await organizer.query(api.sprint.get, { cohortId, profileId: profile._id })).readOnly).toBe(true);
    await expect(other.client.mutation(api.sprint.removeActivity, { activityId: id, expectedRevision: 1 })).rejects.toThrow("own Sprint");
    await expect(other.client.mutation(api.sprint.setProgress, { activityId: id, expectedActivityRevision: 1, expectedProgressRevision: 0, input: { status: "completed", contribution: 0 } })).rejects.toThrow("own Sprint");
    await expect(other.client.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", activityId: id, expectedRevision: 1, expectedProgressRevision: 1, input: task })).rejects.toThrow("own Sprint");
    await expect(hustler.query(api.sprint.get, { cohortId: otherCohort })).rejects.toThrow("active membership");
    await expect(hustler.query(api.sprint.shared, { cohortId })).rejects.toThrow("Only organizers");
    await expect(organizer.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", expectedRevision: 0, expectedProgressRevision: 0, input: task })).rejects.toThrow("active membership");
    for (const client of [t, await identity("outsider@example.com"), await identity("unverified@example.com", false)]) {
      await expect(client.query(api.sprint.get, { cohortId })).rejects.toThrow();
      await expect(client.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", expectedRevision: 0, expectedProgressRevision: 0, input: task })).rejects.toThrow();
      await expect(client.mutation(api.sprint.saveOutcome, { cohortId, input: { type: "meeting", title: "A useful meeting", notes: "", date: "2026-11-03", quantity: 1 } })).rejects.toThrow();
    }
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants.find((item) => item.profileId === profile._id)!._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "revoked" });
    await expect(get()).rejects.toThrow("active Philoxenia invitation");
    await expect(create()).rejects.toThrow();
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", suspended: true });
    await expect(get()).rejects.toThrow("does not have access");
  });

  it("validates the individual stay, handles unscheduled work, warns about overlaps, and rejects stale edits", async () => {
    const { organizer, hustler, profile, cohortId, create, get } = await setup();
    await expect(create({ ...meeting, endAt: meeting.startAt })).rejects.toThrow("after the start");
    await expect(create({ ...task, day: "2026-02-30" })).rejects.toThrow();
    await expect(create({ ...meeting, startAt: parseSfDateTime("2026-11-08T12:00"), endAt: parseSfDateTime("2026-11-08T13:00") })).rejects.toThrow("Keep this activity");
    await expect(create({ ...task, kind: "event" })).rejects.toThrow("Schedule a start and end");
    const id = await create(meeting);
    await expect(create({ ...meeting, title: "Overlapping conversation" })).rejects.toThrow("overlaps");
    await create({ ...meeting, title: "Overlap acknowledged" }, { allowOverlap: true });
    await create({ ...meeting, title: "Adjacent meeting", startAt: meeting.endAt, endAt: meeting.endAt! + 3_600_000 });
    const entry = (await get()).entries.find((item) => item._id === id)!;
    await hustler.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", activityId: id, expectedRevision: entry.revision, expectedProgressRevision: entry.progress.revision, input: { ...task, day: undefined } });
    const updated = (await get()).entries.find((item) => item._id === id)!;
    expect(updated.startAt).toBeUndefined(); expect(updated.endAt).toBeUndefined(); expect(updated.day).toBeUndefined();
    await expect(hustler.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", activityId: id, expectedRevision: entry.revision, expectedProgressRevision: entry.progress.revision, input: task })).rejects.toThrow("changed");
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants.find((item) => item.profileId === profile._id)!._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", startDateOverride: "2026-11-01" });
    expect(await get()).toMatchObject({ startDate: "2026-11-01", endDate: "2026-11-14" });
    await expect(create({ ...task, day: "2026-10-30" })).rejects.toThrow("Keep this activity");
  });

  it("adds an opportunity once transactionally, preserves its snapshot, and retains outcomes when the activity is removed", async () => {
    const { organizer, hustler, cohortId, create, get } = await setup();
    const opportunity = { kind: "event" as const, title: "Public workshop", summary: "Meet other builders and share ideas.", description: "A workshop for product builders. Registration is on the original platform.", interests: ["Developer tools"], categories: ["learn" as const], area: "sf" as const, location: "San Francisco", sourceName: "Original organizer", sourceUrl: "https://example.com/workshop", organizerPick: false, status: "published" as const, startAt: meeting.startAt, endAt: meeting.endAt, cost: "free" as const };
    const opportunityId = await organizer.mutation(api.opportunities.save, { opportunity });
    const attempts = await Promise.allSettled([create(meeting, { opportunityId }), create(meeting, { opportunityId, allowOverlap: true })]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const entry = (await get()).entries[0];
    const source = (await organizer.query(api.opportunities.list, { management: true })).entries[0];
    await organizer.mutation(api.opportunities.save, { opportunityId, expectedUpdatedAt: source.updatedAt, opportunity: { ...opportunity, status: "archived" } });
    const snapshot = (await get()).entries[0];
    expect(snapshot).toMatchObject({ title: meeting.title, sourceUnavailable: true, sourceChanged: true, startAt: meeting.startAt, sourceUrl: opportunity.sourceUrl });
    await hustler.mutation(api.sprint.saveOutcome, { cohortId, activityId: entry._id as FunctionArgs<typeof api.sprint.removeActivity>["activityId"], input: { type: "feedback", title: "Three useful prototype comments", notes: "Self-reported", date: "2026-11-03", quantity: 3 } });
    const data = await get();
    const activityId = data.entries[0]._id as FunctionArgs<typeof api.sprint.removeActivity>["activityId"];
    await hustler.mutation(api.sprint.removeActivity, { activityId, expectedRevision: entry.revision });
    expect((await get()).entries).toHaveLength(0);
    expect((await get()).outcomes[0].activityId).toBeUndefined();
    expect((await get()).outcomes[0].quantity).toBe(3);
    await expect(create(meeting, { opportunityId })).rejects.toThrow("no longer published");
  });

  it("shares cohort activities without sharing personal completion, and supports cancellation and restoration", async () => {
    const { organizer, hustler, cohortId, participant, get, mission, create } = await setup();
    const confirmedAt = await mission();
    const id = await organizer.mutation(api.sprint.saveActivity, { cohortId, scope: "cohort", expectedRevision: 0, expectedProgressRevision: 0, input: { ...meeting, title: "Cohort workshop" } });
    await organizer.mutation(api.sprint.saveActivity, { cohortId, scope: "cohort", expectedRevision: 0, expectedProgressRevision: 0, input: { ...task, kind: "challenge", title: "Ask a useful question" } });
    await expect(hustler.mutation(api.sprint.removeActivity, { activityId: id, expectedRevision: 1 })).rejects.toThrow("Only organizers");
    await expect(create(meeting)).rejects.toThrow("overlaps Cohort workshop");
    await hustler.mutation(api.sprint.setProgress, { activityId: id, expectedActivityRevision: 1, expectedProgressRevision: 0, input: { status: "completed", goalLink: { missionConfirmedAt: confirmedAt, index: 1 }, contribution: 1 } });
    const other = await participant("other@example.com");
    expect((await other.client.query(api.sprint.get, { cohortId })).entries.find((item) => item._id === id)?.progress.status).toBe("planned");
    expect(goalTotals((await get()).entries, confirmedAt)[1]).toBe(1);
    expect((await organizer.query(api.sprint.shared, { cohortId })).entries.find((item) => item._id === id)?.progress.status).toBe("planned");
    await organizer.mutation(api.sprint.removeActivity, { activityId: id, expectedRevision: 1 });
    expect(goalTotals((await get()).entries, confirmedAt)[1]).toBe(0);
    await expect(hustler.mutation(api.sprint.setProgress, { activityId: id, expectedActivityRevision: 1, expectedProgressRevision: 1, input: { status: "completed", contribution: 0 } })).rejects.toThrow("cancelled");
    await organizer.mutation(api.sprint.restoreActivity, { activityId: id, expectedRevision: 2 });
    const restored = (await get()).entries.find((item) => item._id === id)!;
    expect(restored.cancelledAt).toBeUndefined(); expect(restored.progress.status).toBe("completed"); expect(restored.progress.activityRevision).not.toBe(restored.revision);
  });

  it("counts explicit completed contributions, prevents stale progress, and does not reassign progress to replacement missions", async () => {
    const { hustler, cohortId, create, get, mission } = await setup();
    vi.spyOn(Date, "now").mockReturnValue(Date.now());
    const firstVersion = await mission();
    const id = await create(task, { goalLink: { missionConfirmedAt: firstVersion, index: 0 } });
    let entry = (await get()).entries[0];
    expect(goalTotals([entry], firstVersion)).toEqual([0, 0, 0]);
    await hustler.mutation(api.sprint.setProgress, { activityId: id, expectedActivityRevision: entry.revision, expectedProgressRevision: entry.progress.revision, input: { status: "completed", goalLink: entry.progress.goalLink, contribution: 3 } });
    await expect(hustler.mutation(api.sprint.setProgress, { activityId: id, expectedActivityRevision: entry.revision, expectedProgressRevision: entry.progress.revision, input: { status: "planned", contribution: 0 } })).rejects.toThrow("another tab");
    entry = (await get()).entries[0];
    expect(goalTotals([entry], firstVersion)).toEqual([3, 0, 0]);
    const newVersion = await mission();
    expect(newVersion).toBeGreaterThan(firstVersion);
    expect(goalTotals((await get()).entries, newVersion)).toEqual([0, 0, 0]);
    await expect(hustler.mutation(api.sprint.setProgress, { activityId: id, expectedActivityRevision: entry.revision, expectedProgressRevision: entry.progress.revision, input: { status: "completed", goalLink: entry.progress.goalLink, contribution: 3 } })).rejects.toThrow("mission changed");
    await hustler.mutation(api.sprint.setProgress, { activityId: id, expectedActivityRevision: entry.revision, expectedProgressRevision: entry.progress.revision, input: { status: "completed", goalLink: { missionConfirmedAt: newVersion, index: 0 }, contribution: 2 } });
    expect(goalTotals((await get()).entries, newVersion)).toEqual([2, 0, 0]);
    entry = (await get()).entries[0];
    await hustler.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", activityId: id, expectedRevision: entry.revision, expectedProgressRevision: entry.progress.revision, input: task, goalLink: { missionConfirmedAt: newVersion, index: 1 } });
    expect(goalTotals((await get()).entries, newVersion)).toEqual([0, 0, 0]);
  });

  it("keeps outcomes private, separates them from completion, protects edits, and cleans personal Sprint data on account deletion", async () => {
    const { t, organizer, hustler, profile, cohortId, otherCohort, participant, create, get } = await setup();
    const activityId = await create();
    const sharedId = await organizer.mutation(api.sprint.saveActivity, { cohortId, scope: "cohort", expectedRevision: 0, expectedProgressRevision: 0, input: task });
    const input = { type: "funding" as const, title: "Discussed a possible next step", notes: "A conversation, not committed funding.", date: "2026-11-20", quantity: 1 };
    const outcomeId = await hustler.mutation(api.sprint.saveOutcome, { cohortId, activityId, input });
    expect((await get()).entries[0].progress.status).toBe("planned");
    const other = await participant("other@example.com");
    expect((await other.client.query(api.sprint.get, { cohortId })).outcomes).toHaveLength(0);
    const outcome = (await get()).outcomes[0];
    await expect(other.client.mutation(api.sprint.saveOutcome, { cohortId, outcomeId, expectedUpdatedAt: outcome.updatedAt, input })).rejects.toThrow("own outcomes");
    await expect(other.client.mutation(api.sprint.removeOutcome, { outcomeId, expectedUpdatedAt: outcome.updatedAt })).rejects.toThrow("own outcomes");
    await expect(hustler.mutation(api.sprint.saveOutcome, { cohortId: otherCohort, activityId, input })).rejects.toThrow("active membership");
    await hustler.mutation(api.sprint.saveOutcome, { cohortId, outcomeId, activityId, expectedUpdatedAt: outcome.updatedAt, input: { ...input, quantity: 2 } });
    await expect(hustler.mutation(api.sprint.removeOutcome, { outcomeId, expectedUpdatedAt: outcome.updatedAt })).rejects.toThrow("changed");
    await other.client.mutation(api.sprint.setProgress, { activityId: sharedId, expectedActivityRevision: 1, expectedProgressRevision: 0, input: { status: "completed", contribution: 0 } });
    await organizer.mutation(api.users.deleteUser, { profileId: profile._id, confirmationEmail: profile.email });
    expect(await t.run((ctx) => ctx.db.query("sprintActivities").withIndex("by_owner_cohort", (q) => q.eq("ownerId", profile._id)).collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("sprintProgress").withIndex("by_profile_cohort", (q) => q.eq("profileId", profile._id)).collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("sprintOutcomes").collect())).toHaveLength(0);
    expect((await other.client.query(api.sprint.get, { cohortId })).entries[0].progress.status).toBe("completed");
  });
});

describe("Sprint calendar and SF boundaries", () => {
  it("keeps fourteen SF calendar days across DST, handles overnight intervals, and resolves repeated hours explicitly", () => {
    const days = sprintDays("2026-10-25", "2026-11-07"); expect(days).toHaveLength(14); expect(days[7]).toBe("2026-11-01");
    const overnight = { ...meeting, startAt: parseSfDateTime("2026-11-03T23:30"), endAt: parseSfDateTime("2026-11-04T00:30") };
    expect(activityOnDay(overnight, "2026-11-03")).toBe(true); expect(activityOnDay(overnight, "2026-11-04")).toBe(true);
    expect(inStay({ ...overnight, endAt: parseSfDateTime("2026-11-04T00:00") }, "2026-11-03", "2026-11-03")).toBe(true);
    expect(activitySchema.safeParse({ ...task, startAt: meeting.startAt, endAt: meeting.endAt }).success).toBe(false);
    const repeated = sfTimeCandidates("2026-11-01T01:30"); expect(repeated).toEqual([Date.parse("2026-11-01T08:30:00Z"), Date.parse("2026-11-01T09:30:00Z")]);
    expect(() => parseSprintTime("2026-11-01T01:30", "")).toThrow("occurs twice");
    expect(parseSprintTime("2026-11-01T01:30", "second")).toBe(repeated[1]); expect(initialOccurrence(repeated[1])).toBe("second");
    expect(() => parseSprintTime("2027-03-14T02:30", "first")).toThrow("does not exist");
  });

  it("exports UTC events and untimed to-dos with stable IDs, escaped text, UTF-8 folding, and no skipped/cancelled entries", () => {
    const timed = { ...sampleSprintData.entries[0], title: "Δοκιμή, τίτλος; ".repeat(12), notes: "First line\nBEGIN:VEVENT\nA; B, C\\D", startAt: Date.parse("2026-11-01T08:30:00Z"), endAt: Date.parse("2026-11-01T09:30:00Z") };
    const todo = { ...sampleSprintData.entries[1], progress: { ...sampleSprintData.entries[1].progress, status: "completed" as const, completedAt: Date.parse("2026-11-02T17:00:00Z") } };
    const calendar = sprintCalendar([timed, todo, { ...timed, cancelledAt: 2 }, { ...timed, progress: { ...timed.progress, status: "skipped" } }]);
    expect(calendar).toContain("DTSTART:20261101T083000Z\r\nDTEND:20261101T093000Z");
    expect(calendar).toContain("BEGIN:VTODO\r\n"); expect(calendar).toContain("DUE;VALUE=DATE:20261102"); expect(calendar).toContain("STATUS:COMPLETED");
    expect(calendar.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(calendar.replace(/\r\n /g, "")).toContain("DESCRIPTION:First line\\nBEGIN:VEVENT\\nA\\; B\\, C\\\\D");
    for (const line of calendar.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(sprintCalendar([{ ...timed, updatedAt: timed.updatedAt + 1, revision: timed.revision + 1 }])).toContain(`UID:${timed.calendarUid}`);
    expect(sprintCalendar([timed]).endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
