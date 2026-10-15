import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, components } from "../convex/_generated/api";
import { emptyAnswers, templateGoals } from "../lib/mission";
import { cohortCsv, exportKinds } from "../lib/cohort-export";
import { csvFile } from "../lib/command-center";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const instances: ReturnType<typeof convexTest>[] = [];
async function setup() {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T18:00:00Z"));
  vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com,second@example.com"); vi.stubEnv("RESEND_API_KEY", "");
  const t = convexTest(schema, modules); instances.push(t); betterAuthTest.register(t);
  async function identity(email: string, verified = true) {
    const now = Date.now();
    const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email, name: email.split("@")[0], emailVerified: verified, createdAt: now, updatedAt: now } } });
    const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 7 * 86400000, createdAt: now, updatedAt: now } } });
    return t.withIdentity({ subject: user._id, sessionId: session._id });
  }
  const organizer = await identity("organizer@example.com"), second = await identity("second@example.com");
  await organizer.mutation(api.users.ensureProfile, {}); await second.mutation(api.users.ensureProfile, {});
  const cohortId = await organizer.mutation(api.cohorts.create, { name: "Pilot", description: "", startDate: "2026-11-02" });
  const otherCohortId = await organizer.mutation(api.cohorts.create, { name: "Other cohort", description: "", startDate: "2026-12-01" });
  async function participant(email: string, cohort = cohortId) {
    await organizer.mutation(api.invitations.invite, { cohortId: cohort, email, name: "" });
    const client = await identity(email), profile = (await client.mutation(api.users.ensureProfile, {}))!;
    return { client, profile };
  }
  const hustler = await participant("hustler@example.com"), other = await participant("other@example.com", otherCohortId);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, organizer, second, identity, cohortId, otherCohortId, hustler, other };
}
afterEach(async () => {
  for (const t of instances.splice(0)) await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers(); vi.unstubAllEnvs();
});

describe("Stage 7 Command Center", () => {
  it("keeps help private, supports follow-up and rejects stale or unauthorized writes", async () => {
    const { t, organizer, second, hustler, other, cohortId } = await setup();
    const args = { cohortId, message: "I need help finding feedback.", expectedRevision: 0 };
    await expect(other.client.mutation(api.commandCenter.checkIn, args)).rejects.toThrow("active membership");
    await expect(hustler.client.mutation(api.commandCenter.checkIn, { ...args, message: "   " })).rejects.toThrow("5–2,000");
    await hustler.client.mutation(api.commandCenter.checkIn, args);
    const checkin = (await hustler.client.query(api.commandCenter.ownCheckin, { cohortId }))!;
    await expect(other.client.query(api.commandCenter.ownCheckin, { cohortId })).rejects.toThrow("active cohort");
    await expect(other.client.mutation(api.commandCenter.resolveCheckin, { checkinId: checkin._id, expectedRevision: 1 })).rejects.toThrow("unavailable");
    await expect(hustler.client.mutation(api.commandCenter.checkIn, args)).rejects.toThrow("changed");
    const report = await organizer.query(api.commandCenter.cohortSummary, { cohortId });
    expect(report.participants[0].flags.map((f) => f.kind)).toEqual(["help", "onboarding"]);
    expect((await second.query(api.notifications.inbox, {})).some((n) => n.message.includes("asked for help"))).toBe(true);
    expect(JSON.stringify(await other.client.query(api.users.community, {}))).not.toContain(args.message);
    await second.mutation(api.commandCenter.resolveCheckin, { checkinId: checkin._id, expectedRevision: 1 });
    expect((await hustler.client.query(api.commandCenter.ownCheckin, { cohortId }))?.status).toBe("resolved");
    await hustler.client.mutation(api.commandCenter.checkIn, { ...args, expectedRevision: 2 });
    expect((await hustler.client.query(api.commandCenter.ownCheckin, { cohortId }))?.revision).toBe(3);
    expect(await t.run((ctx) => ctx.db.query("helpCheckins").collect())).toHaveLength(1);
  });

  it("separates planned, completed and reported results and explains SF overdue and 48-hour request flags", async () => {
    const { t, organizer, second, cohortId, otherCohortId, hustler, other } = await setup();
    const confirmedAt = Date.now(), goals = templateGoals(emptyAnswers, "2026-11-02", "2026-11-04");
    await t.run(async (ctx) => {
      await ctx.db.insert("onboarding", { profileId: hustler.profile._id, cohortId, answers: emptyAnswers, step: 4, revision: 1, updatedAt: confirmedAt, confirmedAt, confirmedGoals: goals });
      const input = { cohortId, scope: "personal" as const, ownerId: hustler.profile._id, createdBy: hustler.profile._id, kind: "meeting" as const, title: "Feedback meeting", notes: "", location: "SF", startAt: Date.parse("2026-11-04T18:00:00Z"), endAt: Date.parse("2026-11-04T18:30:00Z"), revision: 1, updatedAt: confirmedAt };
      for (const [status, version, contribution, cancelled] of [["completed", confirmedAt, 1, false], ["planned", confirmedAt, 0, false], ["completed", confirmedAt - 1, 99, false], ["completed", confirmedAt, 99, true]] as const) {
        const activityId = await ctx.db.insert("sprintActivities", { ...input, ...(cancelled ? { cancelledAt: confirmedAt } : {}) });
        await ctx.db.insert("sprintProgress", { profileId: hustler.profile._id, cohortId, activityId, status, contribution, goalLink: { index: 0, missionConfirmedAt: version }, revision: 1, activityRevision: 1, updatedAt: confirmedAt });
      }
      await ctx.db.insert("sprintOutcomes", { profileId: hustler.profile._id, cohortId, title: "Received feedback", notes: "Unverified participant report", date: "2026-11-04", type: "feedback", quantity: 3, updatedAt: confirmedAt });
      const offerSnapshot = { title: "Introduction to a founder", kind: "introduction" as const, description: "An actual connection", availability: "Agree a time", capacity: 3, connection: "I can connect you to a colleague.", published: true };
      const offerId = await ctx.db.insert("alumniOffers", { ...offerSnapshot, ownerId: other.profile._id, revision: 1, updatedAt: confirmedAt });
      const requestId = await ctx.db.insert("supportRequests", { offerId, requesterId: hustler.profile._id, alumnusId: other.profile._id, cohortId, goal: "Find feedback", fit: "Useful expertise", offerSnapshot, status: "pending", revision: 1, updatedAt: confirmedAt });
      await ctx.db.insert("supportCoordination", { requestId, organizerId: (await organizer.query(api.users.viewer, {}))!.profile!._id, note: "Private coordination", updatedAt: confirmedAt });
    });
    vi.setSystemTime(new Date("2026-11-05T07:59:00Z")); // Still Nov 4 in SF.
    const before = await organizer.query(api.commandCenter.cohortSummary, { cohortId });
    expect(before.participants[0].flags.some((f) => f.kind === "goal")).toBe(false);
    vi.setSystemTime(new Date("2026-11-05T20:00:00Z"));
    const report = await second.query(api.commandCenter.cohortSummary, { cohortId });
    expect(report.summary).toMatchObject({ plannedMeetings: 1, completedActivities: 2, reportedOutcomes: 1, pendingRequests: 1, onboardingIncomplete: 0 });
    expect(report.participants[0].totals).toEqual([1, 0, 0]);
    expect(report.participants[0].flags.filter((f) => f.kind === "goal")).toHaveLength(3);
    expect(report.participants[0].flags.find((f) => f.kind === "request")?.reason).toContain("48 hours");
    expect(report.participants.some((p) => p.profileId === other.profile._id)).toBe(false);
    expect((await organizer.query(api.commandCenter.cohortSummary, { cohortId: otherCohortId })).participants).toHaveLength(1);
    expect((await organizer.query(api.openDoors.requests, { organizer: true }))[0].coordinatorName).toBe("organizer");
    expect((await hustler.client.query(api.openDoors.requests, {}))[0]).not.toHaveProperty("coordinatorName");
  });

  it("restricts reports, operations and notes to organizers and prevents conflicting note saves", async () => {
    const { organizer, second, hustler, other, cohortId, identity } = await setup();
    await expect(hustler.client.query(api.commandCenter.cohortSummary, { cohortId })).rejects.toThrow("Only organizers");
    await expect(hustler.client.query(api.commandCenter.operations, {})).rejects.toThrow("Only organizers");
    const uninvited = await identity("uninvited@example.com");
    await expect(uninvited.query(api.commandCenter.cohortSummary, { cohortId })).rejects.toThrow("access");
    const args = { cohortId, profileId: hustler.profile._id, note: "PRIVATE organizer follow-up", expectedRevision: 0 };
    await expect(hustler.client.mutation(api.commandCenter.saveNote, args)).rejects.toThrow("Only organizers");
    await organizer.mutation(api.commandCenter.saveNote, args);
    await expect(second.mutation(api.commandCenter.saveNote, args)).rejects.toThrow("Another organizer");
    const report = await second.query(api.commandCenter.cohortSummary, { cohortId });
    expect(report.participants[0].note?.organizerName).toBe("organizer");
    expect(JSON.stringify(await other.client.query(api.users.community, {}))).not.toContain(args.note);
    await hustler.client.mutation(api.commandCenter.checkIn, { cohortId, message: "PRIVATE help message", expectedRevision: 0 });
    const withHelp = await organizer.query(api.commandCenter.cohortSummary, { cohortId });
    for (const kind of exportKinds) {
      const csv = cohortCsv(withHelp, kind); expect(csv).not.toContain("PRIVATE"); expect(csv).toContain("Cohort");
    }
    const operations = await organizer.query(api.commandCenter.operations, {});
    expect(operations.organizerCount).toBe(2); expect(operations.emailConfigured).toBe(false);
    expect(JSON.stringify(operations)).not.toContain("example.com");
  });

  it("enforces suspension, membership and completed-cohort rules and cleans up deleted users", async () => {
    const { t, organizer, hustler, cohortId } = await setup();
    await hustler.client.mutation(api.commandCenter.checkIn, { cohortId, message: "Help with feedback", expectedRevision: 0 });
    await organizer.mutation(api.commandCenter.saveNote, { cohortId, profileId: hustler.profile._id, note: "Follow up", expectedRevision: 0 });
    await organizer.mutation(api.users.setSuspended, { profileId: hustler.profile._id, suspended: true });
    await expect(hustler.client.query(api.commandCenter.ownCheckin, { cohortId })).rejects.toThrow("access");
    expect((await organizer.query(api.commandCenter.cohortSummary, { cohortId })).summary.needingAttention).toBe(0);
    await organizer.mutation(api.users.setSuspended, { profileId: hustler.profile._id, suspended: false });
    const membership = (await organizer.query(api.cohorts.roster, { cohortId })).participants[0];
    await organizer.mutation(api.cohorts.updateMembership, { membershipId: membership._id, status: "revoked" });
    await expect(hustler.client.mutation(api.commandCenter.checkIn, { cohortId, message: "Need help", expectedRevision: 1 })).rejects.toThrow();
    await organizer.mutation(api.cohorts.updateMembership, { membershipId: membership._id, status: "active" });
    await organizer.mutation(api.cohorts.update, { cohortId, name: "Pilot", description: "", startDate: "2026-11-02", status: "completed" });
    await expect(hustler.client.mutation(api.commandCenter.checkIn, { cohortId, message: "Need help", expectedRevision: 1 })).rejects.toThrow("upcoming or active");
    await organizer.mutation(api.users.deleteUser, { profileId: hustler.profile._id, confirmationEmail: hustler.profile.email });
    expect(await t.run((ctx) => ctx.db.query("helpCheckins").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("participantNotes").collect())).toHaveLength(0);
  });

  it("quotes CSV text and neutralizes spreadsheet formula payloads", () => {
    const csv = csvFile(["Name", "Details"], [['  =HYPERLINK("https://example.com")', 'a,b\n"quoted"'], ["\t+SUM(1)", "@payload"]]);
    expect(csv).toContain('"\'  =HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"a,b\n""quoted"""'); expect(csv).toContain("'\t+SUM(1)"); expect(csv).toContain("'@payload");
  });
});
