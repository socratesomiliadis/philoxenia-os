import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, components, internal } from "../convex/_generated/api";
import type { OfferInput } from "../lib/open-doors";
import { parseSfDateTime } from "../lib/opportunities";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const offerInput: OfferInput = { kind: "portfolio", title: "A focused portfolio review", description: "Bring your portfolio and one specific question about explaining your work.", availability: "One 30-minute review; agree a time after approval.", capacity: 1, connection: "", published: true };
const requestInput = { goal: "Get specific feedback on my portfolio.", fit: "Your product design background fits my prototype." };
const meeting = { kind: "meeting" as const, title: "Portfolio review with an alumnus", notes: "Time agreed with the alumnus.", location: "Online", startAt: parseSfDateTime("2026-11-03T10:00"), endAt: parseSfDateTime("2026-11-03T10:30") };
const instances: { finishAllScheduledFunctions: (advanceTimers: () => void) => Promise<void> }[] = [];
async function setup() {
  vi.useFakeTimers(); vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com"); vi.stubEnv("RESEND_API_KEY", "");
  const t = convexTest(schema, modules); instances.push(t); betterAuthTest.register(t);
  async function identity(email: string, verified = true) {
    const now = Date.now();
    const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email, name: email.split("@")[0], emailVerified: verified, createdAt: now, updatedAt: now } } });
    const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 86400000, createdAt: now, updatedAt: now } } });
    return t.withIdentity({ subject: user._id, sessionId: session._id });
  }
  const organizer = await identity("organizer@example.com"); await organizer.mutation(api.users.ensureProfile, {});
  const previousId = await organizer.mutation(api.cohorts.create, { name: "Previous chapter", description: "", startDate: "2026-09-01" });
  const cohortId = await organizer.mutation(api.cohorts.create, { name: "Current chapter", description: "", startDate: "2026-11-02" });
  async function participant(email: string, cohort = cohortId) {
    await organizer.mutation(api.invitations.invite, { cohortId: cohort, email, name: "" });
    const client = await identity(email), profile = (await client.mutation(api.users.ensureProfile, {}))!;
    return { client, profile };
  }
  const alum = await participant("alumnus@example.com", previousId), hustler = await participant("hustler@example.com"), other = await participant("other@example.com");
  await organizer.mutation(api.cohorts.update, { cohortId: previousId, name: "Previous chapter", description: "", startDate: "2026-09-01", status: "completed" });
  await organizer.mutation(api.openDoors.graduate, { cohortId: previousId, profileId: alum.profile._id });
  const offerId = await alum.client.mutation(api.openDoors.saveOffer, { input: offerInput, expectedRevision: 0 });
  const submit = (client = hustler.client) => client.mutation(api.openDoors.submitRequest, { offerId, cohortId, ...requestInput });
  async function drain() { await t.finishAllScheduledFunctions(vi.runAllTimers); }
  await drain();
  return { t, organizer, identity, cohortId, previousId, alum, hustler, other, offerId, submit, drain };
}
afterEach(async () => {
  for (const instance of instances.splice(0)) await instance.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("Stage 5 Open Doors", () => {
  it("graduates only completed-cohort participants and preserves cohort history and independent alumni access", async () => {
    const { organizer, hustler, alum, cohortId, previousId, t } = await setup();
    await expect(hustler.client.mutation(api.openDoors.graduate, { cohortId, profileId: hustler.profile._id })).rejects.toThrow("Only organizers");
    await expect(organizer.mutation(api.openDoors.graduate, { cohortId, profileId: hustler.profile._id })).rejects.toThrow("completed cohort");
    const profile = await t.run((ctx) => ctx.db.get(alum.profile._id)); expect(profile?.isAlumni).toBe(true);
    const membership = await t.run((ctx) => ctx.db.query("memberships").withIndex("by_profile_cohort", (q) => q.eq("profileId", alum.profile._id).eq("cohortId", previousId)).unique());
    expect(membership?.status).toBe("active");
    await organizer.mutation(api.openDoors.graduate, { cohortId: previousId, profileId: alum.profile._id });
    expect((await t.run((ctx) => ctx.db.get(alum.profile._id)))?.graduatedAt).toBe(profile?.graduatedAt);
    await organizer.mutation(api.cohorts.updateMembership, { membershipId: membership!._id, status: "revoked" });
    expect(await alum.client.query(api.openDoors.catalog, {})).toHaveLength(1);
    const organizerProfile = (await organizer.query(api.users.viewer, {}))!.profile!;
    await t.run((ctx) => ctx.db.insert("memberships", { cohortId: previousId, profileId: organizerProfile._id, status: "active" }));
    await organizer.mutation(api.openDoors.graduate, { cohortId: previousId, profileId: organizerProfile._id });
    const viewer = await organizer.query(api.users.viewer, {});
    expect(viewer?.isOrganizer).toBe(true); expect(viewer?.profile?.isAlumni).toBe(true);
  });

  it("shares only explicit public profile fields across cohorts, without email or private onboarding", async () => {
    const { alum, hustler, organizer } = await setup();
    await alum.client.mutation(api.users.saveCommunity, { input: { bio: "Builder and mentor", building: "Developer tools", interests: "Design", offering: "Portfolio reviews" } });
    const people = await hustler.client.query(api.users.community, {}), person = people.find((item) => item._id === alum.profile._id)!;
    expect(person.community?.bio).toBe("Builder and mentor"); expect(person.cohorts[0].status).toBe("completed");
    expect(person).not.toHaveProperty("email"); expect(person).not.toHaveProperty("authUserId"); expect(person).not.toHaveProperty("answers");
    await organizer.mutation(api.users.setSuspended, { profileId: alum.profile._id, suspended: true });
    expect((await hustler.client.query(api.users.community, {})).some((item) => item._id === alum.profile._id)).toBe(false);
    expect(await hustler.client.query(api.openDoors.catalog, {})).toHaveLength(0);
  });

  it("protects offer ownership, private drafts, real introduction paths, and stale edits", async () => {
    const { alum, hustler, organizer, offerId } = await setup();
    await expect(hustler.client.mutation(api.openDoors.saveOffer, { input: offerInput, expectedRevision: 0 })).rejects.toThrow("Only alumni");
    await expect(alum.client.mutation(api.openDoors.saveOffer, { input: { ...offerInput, kind: "introduction" }, expectedRevision: 0 })).rejects.toThrow("actual connection");
    await alum.client.mutation(api.openDoors.saveOffer, { offerId, input: { ...offerInput, published: false }, expectedRevision: 1 });
    expect(await hustler.client.query(api.openDoors.catalog, {})).toHaveLength(0);
    expect(await alum.client.query(api.openDoors.ownOffers, {})).toHaveLength(1);
    await expect(organizer.mutation(api.openDoors.saveOffer, { offerId, input: offerInput, expectedRevision: 2 })).rejects.toThrow("Only alumni");
    await expect(alum.client.mutation(api.openDoors.saveOffer, { offerId, input: offerInput, expectedRevision: 1 })).rejects.toThrow("changed");
  });

  it("limits request reads and decisions to parties, with organizers able to coordinate without approving", async () => {
    const { submit, alum, hustler, other, organizer } = await setup(); const requestId = await submit();
    expect(await other.client.query(api.openDoors.requests, {})).toHaveLength(0);
    expect(await alum.client.query(api.openDoors.requests, {})).toHaveLength(1);
    await expect(other.client.query(api.openDoors.requests, { organizer: true })).rejects.toThrow("Only organizers");
    const args = { requestId, expectedRevision: 1, decision: "approve" as const, response: "Happy to review it." };
    await expect(other.client.mutation(api.openDoors.respond, args)).rejects.toThrow("unavailable");
    await expect(organizer.mutation(api.openDoors.respond, args)).rejects.toThrow("receiving alumnus");
    await organizer.mutation(api.openDoors.coordinate, { requestId, note: "Private: help prepare a focused question." });
    expect((await hustler.client.query(api.openDoors.requests, {}))[0].coordination).toBeNull();
    const coordinated = (await organizer.query(api.openDoors.requests, { organizer: true }))[0]; expect(coordinated.coordination?.note).toContain("Private");
    await expect(organizer.mutation(api.openDoors.coordinate, { requestId, note: "Stale note" })).rejects.toThrow("changed");
    await alum.client.mutation(api.openDoors.respond, args);
    expect((await hustler.client.query(api.openDoors.requests, {}))[0].meeting).toBeNull();
  });

  it("requires alternative acceptance, rejects duplicate requests and reserves capacity transactionally", async () => {
    const { submit, alum, hustler, other, offerId } = await setup();
    const duplicate = await Promise.allSettled([submit(), submit()]); expect(duplicate.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const requestId = (duplicate.find((item) => item.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof submit>>>).value;
    const secondId = await submit(other.client);
    const decisions = await Promise.allSettled([
      alum.client.mutation(api.openDoors.respond, { requestId, expectedRevision: 1, decision: "alternative", response: "I can review your project summary rather than the whole portfolio." }),
      alum.client.mutation(api.openDoors.respond, { requestId: secondId, expectedRevision: 1, decision: "approve", response: "" }),
    ]);
    expect(decisions.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const requests = await alum.client.query(api.openDoors.requests, {}), reserved = requests.find((item) => ["alternative", "agreed"].includes(item.status))!;
    expect((await hustler.client.query(api.openDoors.catalog, {}))[0].remaining).toBe(0);
    if (reserved.status === "alternative") {
      await expect(hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: 2, input: meeting })).rejects.toThrow("agreed support");
      await hustler.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 2, accept: true });
    }
    await expect(alum.client.mutation(api.openDoors.saveOffer, { offerId, input: { ...offerInput, capacity: 0 }, expectedRevision: 1 })).rejects.toThrow();
    const owner = reserved.requesterId === hustler.profile._id ? hustler.client : other.client;
    const current = (await owner.query(api.openDoors.requests, {}))[0];
    await owner.mutation(api.openDoors.participantDecision, { requestId: current._id, expectedRevision: current.revision, accept: false });
    expect((await hustler.client.query(api.openDoors.catalog, {}))[0].remaining).toBe(1);
  });

  it("handles declined and withdrawn requests and rejects stale or unauthorized alternative acceptance", async () => {
    const { submit, alum, hustler, other } = await setup(); const requestId = await submit();
    await alum.client.mutation(api.openDoors.respond, { requestId, expectedRevision: 1, decision: "alternative", response: "I can offer a short async review of your project write-up." });
    await expect(alum.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 2, accept: true })).rejects.toThrow("Only the requester");
    await expect(other.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 2, accept: true })).rejects.toThrow("unavailable");
    await expect(hustler.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 1, accept: true })).rejects.toThrow("changed");
    await hustler.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 2, accept: true });
    await hustler.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 3, accept: false });
    const nextId = await submit();
    await alum.client.mutation(api.openDoors.respond, { requestId: nextId, expectedRevision: 1, decision: "decline", response: "I’m unable to help with this project this month." });
    await expect(hustler.client.mutation(api.openDoors.participantDecision, { requestId: nextId, expectedRevision: 2, accept: true })).rejects.toThrow("proposed alternative");
  });

  it("blocks unverified, revoked, suspended, and cross-cohort requests and rechecks access before acceptance", async () => {
    const { t, identity, hustler, alum, organizer, cohortId, previousId, offerId, submit } = await setup();
    for (const client of [t, await identity("outsider@example.com"), await identity("unverified@example.com", false)]) await expect(client.query(api.openDoors.catalog, {})).rejects.toThrow();
    await expect(hustler.client.mutation(api.openDoors.submitRequest, { offerId, cohortId: previousId, ...requestInput })).rejects.toThrow("belong to");
    const requestId = await submit();
    await alum.client.mutation(api.openDoors.respond, { requestId, expectedRevision: 1, decision: "alternative", response: "I can provide an async review of one selected project." });
    const membership = await t.run((ctx) => ctx.db.query("memberships").withIndex("by_profile_cohort", (q) => q.eq("profileId", hustler.profile._id).eq("cohortId", cohortId)).unique());
    await organizer.mutation(api.cohorts.updateMembership, { membershipId: membership!._id, status: "revoked" });
    await expect(hustler.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 2, accept: true })).rejects.toThrow();
    await organizer.mutation(api.cohorts.updateMembership, { membershipId: membership!._id, status: "active" });
    await organizer.mutation(api.users.setSuspended, { profileId: alum.profile._id, suspended: true });
    await expect(hustler.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 2, accept: true })).rejects.toThrow("no longer available");
  });

  it("completes request-to-meeting-to-outcome flow without inventing attendance or progress, and prevents duplicate meetings", async () => {
    const { submit, alum, hustler, organizer, cohortId } = await setup(); const requestId = await submit();
    await alum.client.mutation(api.openDoors.respond, { requestId, expectedRevision: 1, decision: "approve", response: "Happy to review it." });
    const schedules = await Promise.allSettled([hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: 2, input: meeting }), hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: 2, input: meeting })]);
    expect(schedules.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const data = await hustler.client.query(api.sprint.get, { cohortId }), entry = data.entries[0];
    expect(entry.progress.status).toBe("planned"); expect(entry.progress.contribution).toBe(0);
    await hustler.client.mutation(api.sprint.setProgress, { activityId: entry._id as never, expectedActivityRevision: 1, expectedProgressRevision: 0, input: { status: "completed", contribution: 0 } });
    await hustler.client.mutation(api.sprint.saveOutcome, { cohortId, activityId: entry._id as never, input: { type: "feedback", title: "Received actionable portfolio feedback", notes: "One useful improvement.", date: "2026-11-03", quantity: 1 } });
    expect((await organizer.query(api.openDoors.requests, { organizer: true }))[0].outcomeCount).toBe(1);
    await hustler.client.mutation(api.openDoors.complete, { requestId, expectedRevision: 3, response: "We reviewed my portfolio and identified one useful improvement." });
    expect((await alum.client.query(api.openDoors.requests, {}))[0].status).toBe("completed");
    expect((await hustler.client.query(api.openDoors.catalog, {}))[0].remaining).toBe(1);
    expect((await hustler.client.query(api.sprint.get, { cohortId })).outcomes).toHaveLength(1);
  });

  it("enforces stay dates and overlaps, detaches removed meetings, and allows rescheduling agreed support", async () => {
    const { submit, alum, hustler, cohortId } = await setup(); const requestId = await submit();
    await alum.client.mutation(api.openDoors.respond, { requestId, expectedRevision: 1, decision: "approve", response: "" });
    await expect(hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: 2, input: { ...meeting, startAt: parseSfDateTime("2026-11-16T10:00"), endAt: parseSfDateTime("2026-11-16T11:00") } })).rejects.toThrow("Keep this activity");
    await hustler.client.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", input: meeting, expectedRevision: 0, expectedProgressRevision: 0 });
    await expect(hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: 2, input: meeting })).rejects.toThrow("overlaps");
    const activityId = await hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: 2, input: meeting, allowOverlap: true });
    await expect(hustler.client.mutation(api.openDoors.participantDecision, { requestId, expectedRevision: 3, accept: false })).rejects.toThrow("Remove the linked meeting");
    await hustler.client.mutation(api.sprint.removeActivity, { activityId, expectedRevision: 1 });
    const current = (await hustler.client.query(api.openDoors.requests, {}))[0]; expect(current.activityId).toBeUndefined();
    await hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: current.revision, input: meeting, allowOverlap: true });
  });

  it("isolates notifications and keeps decisions saved after email failure, with bounded organizer retries", async () => {
    const { submit, alum, hustler, other, organizer, t, drain } = await setup(); const requestId = await submit();
    const notice = (await alum.client.query(api.notifications.inbox, {})).find((item) => item.requestId === requestId)!;
    await expect(other.client.mutation(api.notifications.read, { notificationId: notice._id })).rejects.toThrow("unavailable");
    await alum.client.mutation(api.notifications.read, { notificationId: notice._id });
    vi.stubEnv("RESEND_API_KEY", "test-key"); vi.stubEnv("EMAIL_FROM", "Philoxenia <test@example.com>"); vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 503 })));
    await alum.client.mutation(api.openDoors.respond, { requestId, expectedRevision: 1, decision: "approve", response: "" }); await drain();
    expect((await hustler.client.query(api.openDoors.requests, {}))[0].status).toBe("agreed");
    const email = await t.run(async (ctx) => (await ctx.db.query("emailDeliveries").withIndex("by_request", (q) => q.eq("requestId", requestId)).collect()).find((item) => item.profileId === hustler.profile._id)!);
    expect(email.status).toBe("failed");
    await expect(hustler.client.mutation(api.notifications.retry, { deliveryId: email._id })).rejects.toThrow("Only organizers");
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "provider-id" }), { status: 200 })); vi.stubGlobal("fetch", send);
    await organizer.mutation(api.notifications.retry, { deliveryId: email._id }); await drain();
    expect((await t.run((ctx) => ctx.db.get(email._id)))?.status).toBe("sent");
    await t.action(internal.notifications.deliver, { deliveryId: email._id }); expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].headers["Idempotency-Key"]).toContain(email._id);
    await t.run((ctx) => ctx.db.patch(email._id, { status: "failed", attempts: 5 }));
    await expect(organizer.mutation(api.notifications.retry, { deliveryId: email._id })).rejects.toThrow("attempt limit");
    await t.run((ctx) => ctx.db.patch(email._id, { attempts: 2 }));
    vi.advanceTimersByTime(23 * 3_600_000 + 1);
    await expect(organizer.mutation(api.notifications.retry, { deliveryId: email._id })).rejects.toThrow("retry window");
    vi.unstubAllGlobals();
  });

  it("deletes alumni offers and requests while preserving other members’ Sprint activities and outcomes", async () => {
    const { submit, alum, hustler, organizer, cohortId, t } = await setup(); const requestId = await submit();
    await alum.client.mutation(api.openDoors.respond, { requestId, expectedRevision: 1, decision: "approve", response: "" });
    const activityId = await hustler.client.mutation(api.openDoors.schedule, { requestId, expectedRevision: 2, input: meeting });
    await organizer.mutation(api.openDoors.coordinate, { requestId, note: "Private coordination" });
    await hustler.client.mutation(api.sprint.saveOutcome, { cohortId, activityId, input: { type: "meeting", title: "Completed portfolio review", notes: "Useful discussion.", date: "2026-11-03", quantity: 1 } });
    await organizer.mutation(api.users.deleteUser, { profileId: alum.profile._id, confirmationEmail: alum.profile.email });
    expect(await hustler.client.query(api.openDoors.requests, {})).toHaveLength(0);
    expect(await hustler.client.query(api.openDoors.catalog, {})).toHaveLength(0);
    const data = await hustler.client.query(api.sprint.get, { cohortId }); expect(data.entries).toHaveLength(1); expect(data.outcomes).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.get(activityId)))?.supportRequestId).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("supportCoordination").collect())).toHaveLength(0);
  });
});
