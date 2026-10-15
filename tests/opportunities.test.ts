import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, components } from "../convex/_generated/api";
import { defaultOpportunityFilters, filterOpportunities, isUpcomingOpportunity, matchOpportunity, parseSfDateTime, sfCalendarDate, type OpportunityInput } from "../lib/opportunities";
import { templateGoals } from "../lib/mission";
import { sampleOpportunities } from "../lib/sample-opportunities";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const event: OpportunityInput = { kind: "event", title: "Real builder workshop", summary: "Meet builders and learn about developer tools.", description: "A practical workshop. Register on the original platform; approval may be required.", interests: ["Developer tools"], categories: ["learn", "feedback"], area: "sf", location: "San Francisco · venue unannounced", sourceName: "Event organizer", sourceUrl: "https://example.com/workshop", organizerPick: true, status: "draft", startAt: parseSfDateTime("2026-11-03T18:00"), cost: "unknown" };
const answers = { building: "A tool for independent game developers.", outcomes: "Find collaborators and get product feedback.", industries: ["Developer tools"], offering: "React prototypes and product reviews." };

async function setup() {
  vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com");
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  async function identity(email: string, emailVerified = true) {
    const now = Date.now();
    const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email, name: email.split("@")[0], emailVerified, createdAt: now, updatedAt: now } } });
    const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 86_400_000, createdAt: now, updatedAt: now } } });
    return t.withIdentity({ subject: user._id, sessionId: session._id });
  }
  const organizer = await identity("organizer@example.com");
  await organizer.mutation(api.users.ensureProfile, {});
  const cohortId = await organizer.mutation(api.cohorts.create, { name: "First chapter", description: "", startDate: "2026-11-02" });
  async function participant(email: string) {
    await organizer.mutation(api.invitations.invite, { cohortId, email, name: "" });
    const client = await identity(email);
    const profile = (await client.mutation(api.users.ensureProfile, {}))!;
    return { client, profile };
  }
  const { client: hustler, profile } = await participant("hustler@example.com");
  const create = (opportunity: OpportunityInput = event, confirmSupport = false) => organizer.mutation(api.opportunities.save, { opportunity, confirmSupport });
  async function update(id: Awaited<ReturnType<typeof create>>, opportunity: OpportunityInput) {
    const entry = (await organizer.query(api.opportunities.list, { management: true })).entries.find((item) => item._id === id)!;
    return organizer.mutation(api.opportunities.save, { opportunityId: id, expectedUpdatedAt: entry.updatedAt, opportunity });
  }
  return { t, identity, organizer, hustler, profile, cohortId, participant, create, update };
}
afterEach(() => vi.unstubAllEnvs());

describe("Stage 3 opportunity catalog", () => {
  it("hides timed events at their start and past all-day events while retaining organizer records", async () => {
    const { organizer, hustler, create } = await setup();
    const now = Date.now();
    await create({ ...event, status: "published", startAt: now - 1, endAt: now + 3_600_000 });
    const upcoming = await create({ ...event, status: "published", sourceUrl: "https://example.com/upcoming", startAt: now + 60_000 });
    await create({ ...event, status: "published", sourceUrl: "https://example.com/past-all-day", startAt: undefined, eventDate: sfCalendarDate(now - 86_400_000) });
    const todayAllDay = await create({ ...event, status: "published", sourceUrl: "https://example.com/today-all-day", startAt: undefined, eventDate: sfCalendarDate(now) });
    expect((await hustler.query(api.opportunities.list, {})).entries.map((entry) => entry._id)).toEqual(expect.arrayContaining([upcoming, todayAllDay]));
    expect((await hustler.query(api.opportunities.list, {})).entries).toHaveLength(2);
    expect((await organizer.query(api.opportunities.list, { management: true })).entries).toHaveLength(4);
    expect(isUpcomingOpportunity({ ...event, startAt: now }, now)).toBe(false);
  });
  it("keeps drafts and archived listings private, saves bookmarks idempotently per owner, and restores them on republish", async () => {
    const { t, organizer, hustler, cohortId, participant, create, update } = await setup();
    const id = await create();
    expect((await hustler.query(api.opportunities.list, { cohortId })).entries).toHaveLength(0);
    await expect(hustler.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: true })).rejects.toThrow("no longer published");
    await update(id, { ...event, status: "published" });
    await Promise.all([hustler.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: true }), hustler.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: true })]);
    expect(await t.run((ctx) => ctx.db.query("bookmarks").collect())).toHaveLength(1);
    expect((await hustler.query(api.opportunities.list, { cohortId })).entries[0].saved).toBe(true);
    const other = await participant("other@example.com");
    const listing = (await other.client.query(api.opportunities.list, {})).entries[0];
    expect(listing.saved).toBe(false);
    expect(listing).not.toHaveProperty("createdBy");
    expect(listing).not.toHaveProperty("email");
    await update(id, { ...event, status: "archived" });
    expect((await hustler.query(api.opportunities.list, {})).entries).toHaveLength(0);
    expect((await organizer.query(api.opportunities.list, { management: true })).entries[0].status).toBe("archived");
    await update(id, { ...event, status: "published" });
    expect((await hustler.query(api.opportunities.list, {})).entries[0].saved).toBe(true);
    await hustler.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: false });
    await hustler.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: false });
    expect(await t.run((ctx) => ctx.db.query("bookmarks").collect())).toHaveLength(0);
  });

  it("authorizes every read and write, blocks revoked/suspended accounts, and cleans bookmarks on account deletion", async () => {
    const { t, identity, organizer, hustler, profile, create, cohortId } = await setup();
    const id = await create({ ...event, status: "published" });
    await expect(t.query(api.opportunities.list, {})).rejects.toThrow("verified email");
    const outsider = await identity("outsider@example.com");
    const unverified = await identity("unverified@example.com", false);
    for (const client of [outsider, unverified]) {
      await expect(client.query(api.opportunities.list, {})).rejects.toThrow();
      await expect(client.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: true })).rejects.toThrow();
    }
    await expect(hustler.query(api.opportunities.list, { management: true })).rejects.toThrow("Only organizers");
    await expect(hustler.mutation(api.opportunities.save, { opportunity: event })).rejects.toThrow("Only organizers");
    await expect(hustler.mutation(api.opportunities.addCuratedStarters, {})).rejects.toThrow("Only organizers");
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants[0]._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "revoked" });
    await expect(hustler.query(api.opportunities.list, {})).rejects.toThrow("active Philoxenia invitation");
    await expect(hustler.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: true })).rejects.toThrow();
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", suspended: true });
    await expect(hustler.query(api.opportunities.list, {})).rejects.toThrow("does not have access");
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", suspended: false });
    await hustler.mutation(api.opportunities.setBookmark, { opportunityId: id, saved: true });
    await organizer.mutation(api.users.deleteUser, { profileId: profile._id, confirmationEmail: profile.email });
    expect(await t.run((ctx) => ctx.db.query("bookmarks").collect())).toHaveLength(0);
    expect((await organizer.query(api.opportunities.list, {})).entries).toHaveLength(1);
  });

  it("uses only the caller’s interests, confirmed mission categories, and individual cohort dates", async () => {
    const { hustler, organizer, cohortId, participant } = await setup();
    await hustler.mutation(api.onboarding.saveDraft, { cohortId, answers, step: 4 });
    let context = (await hustler.query(api.opportunities.list, { cohortId })).context;
    expect(context.interests).toEqual(["Developer tools"]);
    expect(context.categories).toEqual([]);
    const proposal = await hustler.mutation(api.onboarding.useTemplates, { cohortId });
    await hustler.mutation(api.onboarding.saveProposal, { cohortId, goals: templateGoals(answers, "2026-11-02", "2026-11-15"), expectedRevision: proposal.revision, confirm: true });
    const membershipId = (await organizer.query(api.cohorts.roster, { cohortId })).participants[0]._id;
    await organizer.mutation(api.cohorts.updateMembership, { membershipId, status: "active", startDateOverride: "2026-11-03" });
    context = (await hustler.query(api.opportunities.list, { cohortId })).context;
    expect(context).toMatchObject({ startDate: "2026-11-03", endDate: "2026-11-16" });
    expect(context.categories).toContain("feedback");
    const other = await participant("other@example.com");
    expect((await other.client.query(api.opportunities.list, { cohortId })).context.interests).toEqual([]);
    expect((await organizer.query(api.opportunities.list, { cohortId })).context.interests).toEqual([]);
    const secondCohort = await organizer.mutation(api.cohorts.create, { name: "Second chapter", description: "", startDate: "2027-03-07" });
    await expect(hustler.query(api.opportunities.list, { cohortId: secondCohort })).rejects.toThrow("cohort you belong to");
  });

  it("validates event times and sources, requires attested alumni offers, and clears incompatible fields when changing type", async () => {
    const { t, organizer, create } = await setup();
    await expect(create({ ...event, sourceUrl: "javascript:alert(1)" })).rejects.toThrow("source link");
    await expect(create({ ...event, startAt: undefined })).rejects.toThrow("event start time");
    await expect(create({ ...event, endAt: event.startAt! - 1 })).rejects.toThrow("after the start");
    const { startAt, cost, ...directory } = event;
    expect(startAt).toBeDefined(); expect(cost).toBeDefined();
    const offer: OpportunityInput = { ...directory, kind: "alumni", status: "published", support: { offeredBy: "Confirmed Alumnus", pathway: "Request an introduction to a founder I worked with through this booking form.", url: "https://example.com/request", availability: "One request during the November cohort" } };
    await expect(create(offer)).rejects.toThrow("alumnus agreed");
    const offerId = await create(offer, true);
    expect((await t.run((ctx) => ctx.db.get(offerId)))?.supportConfirmedAt).toBeTypeOf("number");
    await expect(create({ ...offer, sourceUrl: "https://example.com/another", support: undefined }, true)).rejects.toThrow("confirmed support path");
    const id = await create();
    await expect(create({ ...event, sourceUrl: "https://example.com/workshop/?utm_source=test#tickets" })).rejects.toThrow("already listed");
    const existing = (await organizer.query(api.opportunities.list, { management: true })).entries.find((item) => item._id === id)!;
    await organizer.mutation(api.opportunities.save, { opportunityId: id, expectedUpdatedAt: existing.updatedAt, opportunity: { ...directory, kind: "founder", status: "published" } });
    const founder = await t.run((ctx) => ctx.db.get(id));
    expect(founder?.kind).toBe("founder");
    expect(founder).not.toHaveProperty("startAt");
    expect(founder).not.toHaveProperty("cost");
  });

  it("protects newer edits and seeds curated drafts without duplicates or overwriting curation", async () => {
    const { organizer, hustler, create, update } = await setup();
    const id = await create();
    const old = (await organizer.query(api.opportunities.list, { management: true })).entries[0];
    await update(id, { ...event, title: "Organizer revision" });
    await expect(organizer.mutation(api.opportunities.save, { opportunityId: id, expectedUpdatedAt: old.updatedAt, opportunity: event })).rejects.toThrow("Another organizer changed");
    expect((await organizer.mutation(api.opportunities.addCuratedStarters, {})).added).toBe(4);
    const starter = (await organizer.query(api.opportunities.list, { management: true })).entries.find((item) => item.title === "LangChain")!;
    const { _id, saved, updatedAt, _creationTime, createdBy, ...input } = starter;
    expect(saved).toBe(false); expect(_creationTime).toBeDefined(); expect(createdBy).toBeDefined();
    await organizer.mutation(api.opportunities.save, { opportunityId: _id, expectedUpdatedAt: updatedAt, opportunity: { ...input, title: "Our curated LangChain entry" } });
    expect((await organizer.mutation(api.opportunities.addCuratedStarters, {})).added).toBe(0);
    const entries = (await organizer.query(api.opportunities.list, { management: true })).entries;
    expect(entries).toHaveLength(5);
    expect(entries.find((item) => item._id === _id)?.title).toBe("Our curated LangChain entry");
    expect((await hustler.query(api.opportunities.list, {})).entries).toHaveLength(0);
  });
});

describe("Opportunity matching and SF dates", () => {
  it("filters locations, full-text terms, cost, bookmarks and inclusive SF date boundaries", () => {
    const base = defaultOpportunityFilters;
    expect(filterOpportunities(sampleOpportunities, base).every((item) => item.area === "sf")).toBe(true);
    expect(filterOpportunities(sampleOpportunities, { ...base, area: "bay-area" }).some((item) => item.area === "bay-area")).toBe(true);
    expect(filterOpportunities(sampleOpportunities, { ...base, area: "bay-area" }).some((item) => item.area === "online")).toBe(false);
    expect(filterOpportunities(sampleOpportunities, { ...base, search: "builders feedback" }).map((item) => item.title)).toContain("Builders & good questions");
    expect(filterOpportunities(sampleOpportunities, { ...base, kind: "event", cost: "free", from: "2026-11-04", to: "2026-11-04" }).map((item) => item.title)).toEqual(["Builders & good questions"]);
    expect(filterOpportunities(sampleOpportunities, { ...base, savedOnly: true })).toHaveLength(0);
    const atBoundary = { ...sampleOpportunities[0], startAt: Date.parse("2026-11-05T07:30:00Z") };
    expect(sfCalendarDate(atBoundary.startAt)).toBe("2026-11-04");
    expect(filterOpportunities([atBoundary], { ...base, from: "2026-11-04", to: "2026-11-04" })).toHaveLength(1);
    expect(() => parseSfDateTime("2027-03-14T02:30")).toThrow("does not exist");
    expect(parseSfDateTime("2027-03-14T03:30")).toBe(Date.parse("2027-03-14T10:30:00Z"));
    expect(parseSfDateTime("2026-11-01T03:30")).toBe(Date.parse("2026-11-01T11:30:00Z"));
  });

  it("explains ranking with interests, confirmed mission categories, individual stay dates and organizer picks", () => {
    const match = matchOpportunity({ ...event, startAt: parseSfDateTime("2026-11-04T23:30") }, { interests: ["Developer tools"], categories: ["feedback"], startDate: "2026-11-04", endDate: "2026-11-04" });
    expect(match.reasons).toEqual(["Matches Developer tools", "During your stay", "Supports your mission: get feedback", "Organizer pick"]);
    expect(match.score).toBeGreaterThan(matchOpportunity(event, { interests: [], categories: [] }).score);
  });
});
