import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, components, internal } from "../convex/_generated/api";
import { missionPrompt, templateGoals, validateGoals } from "../lib/mission";

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock("ai", async (importOriginal) => ({ ...await importOriginal<typeof import("ai")>(), generateText }));
const modules = import.meta.glob("../convex/**/*.{ts,js}");
const answers = { building: "A feedback tool for independent game developers.", outcomes: "Test my prototype with founders and find collaborators.", industries: ["Developer tools"], offering: "React prototypes and landing page reviews." };

async function setup() {
  vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com");
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  async function identity(email: string) {
    const now = Date.now();
    const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email, name: email.split("@")[0], emailVerified: true, createdAt: now, updatedAt: now } } });
    const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 86_400_000, createdAt: now, updatedAt: now } } });
    return t.withIdentity({ subject: user._id, sessionId: session._id });
  }
  const organizer = await identity("organizer@example.com");
  await organizer.mutation(api.users.ensureProfile, {});
  const cohortId = await organizer.mutation(api.cohorts.create, { name: "First chapter", description: "", startDate: "2026-10-25" });
  const otherCohort = await organizer.mutation(api.cohorts.create, { name: "Second chapter", description: "", startDate: "2027-03-07" });
  async function participant(email: string) {
    await organizer.mutation(api.invitations.invite, { cohortId, email, name: "" });
    const client = await identity(email);
    const profile = await client.mutation(api.users.ensureProfile, {});
    return { client, profile: profile! };
  }
  const { client: hustler, profile } = await participant("hustler@example.com");
  return { t, organizer, hustler, profile, cohortId, otherCohort, participant };
}

beforeEach(() => { generateText.mockReset(); vi.stubEnv("GROQ_API_KEY", ""); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", ""); vi.stubEnv("MISSION_AI_PROVIDER", "groq"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Stage 2 missions", () => {
  it("resumes partial drafts, isolates owners/cohorts, and lets organizers read confirmed missions", async () => {
    const { t, hustler, organizer, profile, cohortId, otherCohort, participant } = await setup();
    expect(await hustler.query(api.onboarding.required, {})).toBe(cohortId);
    expect(await organizer.query(api.onboarding.required, {})).toBeNull();
    await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers: { ...answers, offering: "" }, step: 3 });
    expect(await hustler.query(api.onboarding.get, { cohortId })).toMatchObject({ step: 3, answers: { offering: "" } });
    expect(await hustler.query(api.onboarding.required, {})).toBe(cohortId);
    await expect(hustler.action(api.missions.generate, { cohortId })).rejects.toThrow("Complete all four");
    await expect(t.query(api.onboarding.get, { cohortId })).rejects.toThrow("verified email");
    await expect(hustler.mutation(api.onboarding.saveDraft, { cohortId: otherCohort, answers, step: 0 })).rejects.toThrow("active membership");
    const other = await participant("other@example.com");
    await expect(other.client.query(api.onboarding.get, { cohortId, profileId: profile._id })).rejects.toThrow("only view your own");
    expect(await other.client.query(api.onboarding.get, { cohortId })).toBeNull();
    await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers, step: 4 });
    const result = await hustler.action(api.missions.generate, { cohortId });
    expect(result.source).toBe("template");
    expect(result.fallbackReason).toBe("unconfigured");
    expect(result.goals).toHaveLength(3);
    expect(await hustler.query(api.onboarding.required, {})).toBe(cohortId);
    await hustler.mutation(api.onboarding.saveProposal, { cohortId, goals: result.goals, expectedRevision: result.revision, confirm: true });
    expect(await hustler.query(api.onboarding.required, {})).toBeNull();
    expect((await organizer.query(api.onboarding.get, { cohortId, profileId: profile._id }))?.confirmedGoals).toEqual(result.goals);
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants.find((p) => p.profileId === profile._id)!._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "revoked" });
    await expect(hustler.query(api.onboarding.get, { cohortId })).rejects.toThrow("active Philoxenia invitation");
    await expect(hustler.action(api.missions.generate, { cohortId })).rejects.toThrow("active Philoxenia invitation");
  });

  it("requires a new cohort’s mission while keeping completed cohorts out of the entry flow", async () => {
    const { hustler, organizer, cohortId, otherCohort } = await setup();
    await organizer.mutation(api.cohorts.update, { cohortId, name: "First chapter", description: "", startDate: "2026-10-25", status: "completed" });
    expect(await hustler.query(api.onboarding.required, {})).toBeNull();
    await organizer.mutation(api.invitations.invite, { cohortId: otherCohort, email: "hustler@example.com", name: "" });
    await hustler.mutation(api.users.ensureProfile, {});
    expect(await hustler.query(api.onboarding.required, {})).toBe(otherCohort);
    await hustler.mutation(api.onboarding.saveDraft, { cohortId: otherCohort, answers, step: 4 });
    const result = await hustler.mutation(api.onboarding.useTemplates, { cohortId: otherCohort });
    await hustler.mutation(api.onboarding.saveProposal, { cohortId: otherCohort, goals: result.goals, expectedRevision: result.revision, confirm: true });
    expect(await hustler.query(api.onboarding.required, {})).toBeNull();
  });

  it("validates measurable goals and overridden stay dates, preserving confirmed edits on regeneration", async () => {
    const { hustler, organizer, profile, cohortId } = await setup();
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants[0]._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", startDateOverride: "2026-11-03" });
    await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers, step: 4 });
    const result = await hustler.mutation(api.onboarding.useTemplates, { cohortId });
    expect(result.goals.every((goal) => goal.deadline === "2026-11-16")).toBe(true);
    const edited = result.goals.map((goal, i) => i === 0 ? { ...goal, title: "Get prototype feedback", target: 4 } : goal);
    for (const invalid of [edited.slice(0, 2), edited.map((goal) => ({ ...goal, target: 0 })), edited.map((goal) => ({ ...goal, deadline: "2026-11-17" }))]) {
      await expect(hustler.mutation(api.onboarding.saveProposal, { cohortId, goals: invalid, expectedRevision: result.revision, confirm: true })).rejects.toThrow();
    }
    const confirmedRevision = await hustler.mutation(api.onboarding.saveProposal, { cohortId, goals: edited, expectedRevision: result.revision, confirm: true });
    await expect(hustler.mutation(api.onboarding.saveProposal, { cohortId, goals: edited, expectedRevision: result.revision, confirm: true })).rejects.toThrow("another window");
    await hustler.action(api.missions.generate, { cohortId });
    expect((await hustler.query(api.onboarding.get, { cohortId }))?.confirmedGoals).toEqual(edited);
    expect((await organizer.query(api.onboarding.get, { cohortId, profileId: profile._id }))?.revision).toBeGreaterThan(confirmedRevision);
  });

  it("handles provider failures and malformed output, limits requests atomically, and keeps templates available", async () => {
    const { hustler, cohortId } = await setup();
    vi.stubEnv("GROQ_API_KEY", "test-only-key");
    const clock = vi.spyOn(Date, "now");
    const start = Date.now();
    clock.mockReturnValue(start);
    await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers, step: 4 });
    generateText.mockRejectedValueOnce(new Error("quota or timeout"));
    const result = await hustler.action(api.missions.generate, { cohortId });
    expect(result).toMatchObject({ source: "template", fallbackReason: "unavailable" });
    expect(generateText.mock.calls[0][0]).toMatchObject({ timeout: 25_000, maxRetries: 0 });
    await expect(hustler.action(api.missions.generate, { cohortId })).rejects.toThrow("one minute");
    for (let attempt = 1; attempt < 5; attempt++) {
      clock.mockReturnValue(start + attempt * 61_000);
      generateText.mockResolvedValueOnce({ output: { goals: [] } });
      expect((await hustler.action(api.missions.generate, { cohortId })).source).toBe("template");
    }
    clock.mockReturnValue(start + 5 * 61_000);
    await expect(hustler.action(api.missions.generate, { cohortId })).rejects.toThrow("five generations");
    expect((await hustler.mutation(api.onboarding.useTemplates, { cohortId })).goals).toHaveLength(3);
    clock.mockReturnValue(start + 3_600_001);
    const goals = templateGoals(answers, "2026-10-25", "2026-11-07");
    generateText.mockResolvedValueOnce({ output: { goals } });
    expect((await hustler.action(api.missions.generate, { cohortId })).source).toBe("ai");
  });

  it("discards stale completions and rechecks revoked access after a provider call", async () => {
    const { hustler, organizer, cohortId } = await setup();
    await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers, step: 4 });
    const input = await hustler.mutation(internal.onboarding.beginGeneration, { cohortId, generationId: "test-request" });
    const goals = templateGoals(answers, input.startDate, input.endDate);
    await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers: { ...answers, building: "A different project for climate founders." }, step: 0 });
    await expect(hustler.mutation(internal.onboarding.finishGeneration, { cohortId, generationId: "test-request", revision: input.revision, goals, source: "ai" })).rejects.toThrow("changed during generation");
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants[0]._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", suspended: true });
    await expect(hustler.mutation(internal.onboarding.finishGeneration, { cohortId, generationId: "test-request", revision: input.revision, goals, source: "ai" })).rejects.toThrow("does not have access");
  });

  it("sends only the onboarding fields and dates, redacting common contact details", () => {
    const prompt = missionPrompt({ ...answers, building: "Contact me at private@example.com or +30 691 234 5678 https://private.example.com" }, "2026-10-25", "2026-11-07");
    expect(prompt).not.toContain("private@example.com");
    expect(prompt).not.toContain("691 234 5678");
    expect(prompt).not.toContain("private.example.com");
    expect(Object.keys(JSON.parse(prompt))).toEqual(["building", "outcomes", "industries", "offering", "startDate", "endDate"]);
    expect(() => validateGoals(templateGoals(answers, "2026-10-25", "2026-11-07"), "2026-10-25", "2026-11-07")).not.toThrow();
  });
});
