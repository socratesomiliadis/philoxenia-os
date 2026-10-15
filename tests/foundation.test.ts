import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, components } from "../convex/_generated/api";
import { sprintDates } from "../lib/cohort-dates";
import { templateGoals } from "../lib/mission";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

function setup() {
  vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com");
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}

async function identity(t: ReturnType<typeof setup>, email: string, verified = true) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email, name: email.split("@")[0], emailVerified: verified, createdAt: now, updatedAt: now } } });
  const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 60_000, createdAt: now, updatedAt: now } } });
  return t.withIdentity({ subject: user._id, sessionId: session._id });
}

afterEach(() => vi.unstubAllEnvs());

describe("Stage 1 foundation", () => {
  it("permanently deletes a user across cohorts and auth records, then allows a fresh invitation and onboarding", async () => {
    const t = setup();
    const organizer = await identity(t, "organizer@example.com");
    await organizer.mutation(api.users.ensureProfile, {});
    const cohortId = await organizer.mutation(api.cohorts.create, { name: "First chapter", description: "", startDate: "2026-11-02" });
    const secondCohortId = await organizer.mutation(api.cohorts.create, { name: "Second chapter", description: "", startDate: "2027-01-04" });
    for (const id of [cohortId, secondCohortId]) await organizer.mutation(api.invitations.invite, { cohortId: id, email: "hustler@example.com", name: "Test Hustler" });
    const hustler = await identity(t, "hustler@example.com");
    const profile = (await hustler.mutation(api.users.ensureProfile, {}))!;
    const answers = { building: "A tool for independent game developers.", outcomes: "Meet founders and get product feedback.", industries: ["Developer tools"], offering: "React prototypes and product reviews." };
    for (const id of [cohortId, secondCohortId]) await hustler.mutation(api.onboarding.saveDraft, { cohortId: id, answers, step: 4 });
    const proposal = await hustler.mutation(api.onboarding.useTemplates, { cohortId });
    await hustler.mutation(api.onboarding.saveProposal, { cohortId, goals: templateGoals(answers, "2026-11-02", "2026-11-15"), expectedRevision: proposal.revision, confirm: true });
    await t.run(async (ctx) => { await ctx.db.insert("missionGenerationLimits", { profileId: profile._id, count: 5, windowStart: Date.now(), lastAttempt: Date.now() }); });
    await t.mutation(components.betterAuth.adapter.create, { input: { model: "account", data: { userId: profile.authUserId, providerId: "google", accountId: "test-google-account", createdAt: Date.now(), updatedAt: Date.now() } } });
    // More than one page ensures deletion clears every session, not just the first.
    for (let i = 0; i < 101; i++) await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: profile.authUserId, token: crypto.randomUUID(), expiresAt: Date.now() + 60_000, createdAt: Date.now(), updatedAt: Date.now() } } });
    await t.mutation(components.betterAuth.adapter.create, { input: { model: "verification", data: { identifier: profile.email, value: "test-verification", expiresAt: Date.now() + 60_000, createdAt: Date.now(), updatedAt: Date.now() } } });

    await expect(organizer.mutation(api.users.deleteUser, { profileId: profile._id, confirmationEmail: "wrong@example.com" })).rejects.toThrow("Type this user’s email");
    expect(await t.run((ctx) => ctx.db.get(profile._id))).not.toBeNull();
    await organizer.mutation(api.users.deleteUser, { profileId: profile._id, confirmationEmail: "HUSTLER@example.com" });
    for (const id of [cohortId, secondCohortId]) {
      const roster = await organizer.query(api.cohorts.roster, { cohortId: id });
      expect(roster.participants).toHaveLength(0);
      expect(roster.invitations).toHaveLength(0);
    }
    expect(await t.run((ctx) => ctx.db.get(profile._id))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("onboarding").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("missionGenerationLimits").collect())).toHaveLength(0);
    for (const model of ["session", "account"] as const) expect(await t.query(components.betterAuth.adapter.findOne, { model, where: [{ field: "userId", operator: "eq", value: profile.authUserId }] })).toBeNull();
    expect(await t.query(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "_id", operator: "eq", value: profile.authUserId }] })).toBeNull();
    expect(await t.query(components.betterAuth.adapter.findOne, { model: "verification", where: [{ field: "identifier", operator: "eq", value: profile.email }] })).toBeNull();
    expect(await hustler.query(api.users.viewer, {})).toBeNull();
    await expect(hustler.mutation(api.users.ensureProfile, {})).rejects.toThrow();
    expect((await organizer.query(api.cohorts.list, {}))).toHaveLength(2);

    await organizer.mutation(api.invitations.invite, { cohortId, email: profile.email, name: "Test Hustler" });
    const freshHustler = await identity(t, profile.email);
    const freshProfile = (await freshHustler.mutation(api.users.ensureProfile, {}))!;
    expect(freshProfile._id).not.toBe(profile._id);
    expect(freshProfile.authUserId).not.toBe(profile.authUserId);
    expect(await freshHustler.query(api.onboarding.get, { cohortId })).toBeNull();
    expect(await freshHustler.query(api.onboarding.required, {})).toBe(cohortId);
  });

  it("restricts deletion to organizers and protects organizer accounts", async () => {
    const t = setup();
    const organizer = await identity(t, "organizer@example.com");
    const organizerProfile = (await organizer.mutation(api.users.ensureProfile, {}))!;
    const cohortId = await organizer.mutation(api.cohorts.create, { name: "First chapter", description: "", startDate: "2026-11-02" });
    await organizer.mutation(api.invitations.invite, { cohortId, email: "hustler@example.com", name: "" });
    const hustler = await identity(t, "hustler@example.com");
    const profile = (await hustler.mutation(api.users.ensureProfile, {}))!;
    const args = { profileId: profile._id, confirmationEmail: profile.email };
    await expect(t.mutation(api.users.deleteUser, args)).rejects.toThrow("verified email");
    await expect(hustler.mutation(api.users.deleteUser, args)).rejects.toThrow("Only organizers");
    await expect(organizer.mutation(api.users.deleteUser, { profileId: organizerProfile._id, confirmationEmail: organizerProfile.email })).rejects.toThrow("Organizer accounts cannot be deleted");
    vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com,second@example.com");
    const second = await identity(t, "second@example.com");
    const secondProfile = (await second.mutation(api.users.ensureProfile, {}))!;
    await expect(organizer.mutation(api.users.deleteUser, { profileId: secondProfile._id, confirmationEmail: secondProfile.email })).rejects.toThrow("Organizer accounts cannot be deleted");
    expect(await t.run((ctx) => ctx.db.get(profile._id))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(secondProfile._id))).not.toBeNull();
  });

  it("accepts an invitation once, isolates cohort data, and enforces revocation", async () => {
    const t = setup();
    const organizer = await identity(t, "organizer@example.com");
    await organizer.mutation(api.users.ensureProfile, {});
    const cohortId = await organizer.mutation(api.cohorts.create, { name: "First chapter", description: "", startDate: "2026-11-02" });
    await organizer.mutation(api.cohorts.create, { name: "Another chapter", description: "", startDate: "2027-01-04" });
    await organizer.mutation(api.invitations.invite, { cohortId, email: "  HUSTLER@example.com  ", name: "Hustler" });
    await expect(organizer.mutation(api.invitations.invite, { cohortId, email: "hustler@example.com", name: "" })).rejects.toThrow("already been invited");
    const hustler = await identity(t, "hustler@example.com");
    await hustler.mutation(api.users.ensureProfile, {});
    await hustler.mutation(api.users.ensureProfile, {});
    expect(await hustler.query(api.cohorts.list, {})).toHaveLength(1);
    await expect(hustler.query(api.cohorts.roster, { cohortId })).rejects.toThrow("Only organizers");
    await expect(hustler.mutation(api.cohorts.create, { name: "Unauthorized", description: "", startDate: "2026-11-02" })).rejects.toThrow("Only organizers");
    const roster = await organizer.query(api.cohorts.roster, { cohortId });
    expect(roster.participants).toHaveLength(1);
    const membershipId = roster.participants[0]._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", startDateOverride: "2026-11-03" });
    expect((await hustler.query(api.cohorts.list, {}))[0]).toMatchObject({ startDate: "2026-11-03", endDate: "2026-11-16" });
    expect((await organizer.query(api.cohorts.list, {})).find((c) => c._id === cohortId)?.startDate).toBe("2026-11-02");
    expect((await hustler.query(api.users.community, {}))[0]).not.toHaveProperty("email");
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "revoked" });
    expect((await hustler.query(api.users.viewer, {}))?.allowed).toBe(false);
    await expect(hustler.query(api.users.community, {})).rejects.toThrow("active Philoxenia invitation");
    await expect(hustler.mutation(api.users.ensureProfile, {})).rejects.toThrow("active Philoxenia invitation");
  });

  it("rejects unauthenticated, uninvited, unverified, and suspended accounts", async () => {
    const t = setup();
    await expect(t.query(api.cohorts.list, {})).rejects.toThrow("verified email address");
    const outsider = await identity(t, "outsider@example.com");
    expect((await outsider.query(api.users.viewer, {}))?.allowed).toBe(false);
    await expect(outsider.mutation(api.users.ensureProfile, {})).rejects.toThrow("does not have access");
    const unverified = await identity(setup(), "organizer@example.com", false);
    await expect(unverified.mutation(api.users.ensureProfile, {})).rejects.toThrow("verified email address");
    const organizer = await identity(t, "organizer@example.com");
    await organizer.mutation(api.users.ensureProfile, {});
    const cohortId = await organizer.mutation(api.cohorts.create, { name: "First chapter", description: "", startDate: "2026-11-02" });
    const invitationId = await organizer.mutation(api.invitations.invite, { cohortId, email: "hustler@example.com", name: "" });
    await organizer.mutation(api.invitations.revoke, { invitationId });
    const hustler = await identity(t, "hustler@example.com");
    await expect(hustler.mutation(api.users.ensureProfile, {})).rejects.toThrow("does not have access");
    await organizer.mutation(api.invitations.invite, { cohortId, email: "hustler@example.com", name: "" });
    await hustler.mutation(api.users.ensureProfile, {});
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants[0]._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", suspended: true });
    await expect(hustler.query(api.cohorts.list, {})).rejects.toThrow("does not have access");
    await expect(hustler.mutation(api.users.ensureProfile, {})).rejects.toThrow("suspended");
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", suspended: false });
    expect(await hustler.query(api.cohorts.list, {})).toHaveLength(1);
  });

  it("creates fourteen calendar days across SF daylight saving and rejects invalid dates", () => {
    expect(sprintDates("2026-10-25")).toEqual({ startDate: "2026-10-25", endDate: "2026-11-07" });
    expect(sprintDates("2027-03-07")).toEqual({ startDate: "2027-03-07", endDate: "2027-03-20" });
    expect(() => sprintDates("2026-02-30")).toThrow("valid arrival date");
  });
});
