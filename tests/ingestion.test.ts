import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { parseLumaCalendar } from "../lib/luma-ical";
import { lumaCalendar } from "./fixtures/luma-calendar";
import { api, internal, components } from "../convex/_generated/api";
import { DAY, DEFAULT_LUMA_FEED_URL, normalizeSerpEvent, parseYcCsv, type ImportProvider } from "../lib/ingestion";
import { defaultOpportunityFilters, filterOpportunities, opportunitySchema } from "../lib/opportunities";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const now = Date.parse("2026-10-15T12:00:00Z");
const record = () => parseLumaCalendar(lumaCalendar(), now).records[0];
const csv = 'title,summary,description,sourceUrl,interests,area,location\r\n"Sample, Inc",A useful directory listing,"Build tools for founders, with "+""quoted"" text",https://www.ycombinator.com/companies/sample,Developer tools|AI,sf,San Francisco';
const validCsv = 'title,summary,description,sourceUrl,interests,area,location\r\n"Sample, Inc",A useful directory listing,"Build tools for founders, with ""quoted"" text",https://www.ycombinator.com/companies/sample,Developer tools|AI,sf,San Francisco';

async function setup() {
  vi.useFakeTimers(); vi.setSystemTime(now);
  vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com"); vi.stubEnv("SERPAPI_API_KEY", "test-serp-key");
  const t = convexTest(schema, modules); betterAuthTest.register(t);
  async function identity(email: string, emailVerified = true) {
    const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email, name: email.split("@")[0], emailVerified, createdAt: now, updatedAt: now } } });
    const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 50 * DAY, createdAt: now, updatedAt: now } } });
    return t.withIdentity({ subject: user._id, sessionId: session._id });
  }
  const organizer = await identity("organizer@example.com");
  const profile = (await organizer.mutation(api.users.ensureProfile, {}))!;
  async function configure(provider: ImportProvider = "luma", monthlyLimit = 200, autoPublish = false) {
    await organizer.mutation(api.ingestion.configure, { provider, enabled: true, autoPublish, ...(provider === "serpapi" ? { monthlyLimit } : {}) });
  }
  async function run(provider: ImportProvider = "luma") {
    const runId = (await organizer.mutation(api.ingestion.refresh, { provider }))!;
    await t.mutation(internal.ingestion.claim, { runId }); return runId;
  }
  async function imported() {
    await configure(); const runId = await run();
    await t.mutation(internal.ingestion.complete, { runId, records: [record()], skipped: 0 });
    return (await organizer.query(api.opportunities.list, { management: true })).entries[0];
  }
  return { t, organizer, identity, profile, configure, run, imported };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Stage 6 normalization", () => {
  it("interprets SerpApi SF dates across year rollover, rejects missing/ambiguous times, and does not invent free tickets", () => {
    const base = { title: "Founders event", date: { when: "Oct 20, 6:00 PM" }, address: ["San Francisco, CA"], ticket_info: [{ link: "https://luma.com/builders" }] };
    const r = normalizeSerpEvent(base, now)!; expect(r.opportunity.startAt).toBe(Date.parse("2026-10-21T01:00:00Z")); expect(r.opportunity.cost).toBe("unknown");
    expect(normalizeSerpEvent({ ...base, date: { when: "Nov 1, 2026, 1:30 AM" } }, now)).toBeNull();
    expect(normalizeSerpEvent({ ...base, date: { when: "Oct 20" } }, now)).toBeNull();
    expect(normalizeSerpEvent({ ...base, date: { when: "Jan 2, 6:00 PM" } }, Date.parse("2026-12-28T12:00:00Z"))!.opportunity.startAt).toBe(Date.parse("2027-01-03T02:00:00Z"));
  });
  it("parses quoted CSV and rejects invalid rows and limits before writing", () => {
    expect(parseYcCsv(validCsv)[0].opportunity).toMatchObject({ title: "Sample, Inc", interests: ["Developer tools", "AI"], status: "draft" });
    expect(() => parseYcCsv(csv)).toThrow();
    expect(() => parseYcCsv(validCsv.replace("www.ycombinator.com", "evil.example"))).toThrow("Row 2");
    expect(() => parseYcCsv(validCsv.replace("https:", "http:"))).toThrow("Row 2");
    expect(() => parseYcCsv(validCsv.replace("www.ycombinator.com", "www.ycombinator.com:8443"))).toThrow("Row 2");
    expect(() => parseYcCsv("a".repeat(200_001))).toThrow("200 KB");
    expect(() => parseYcCsv(validCsv + "\n" + Array(50).fill(validCsv.split("\r\n")[1]).join("\n"))).toThrow("50 YC");
  });
  it("keeps SF events in the default filter using the documented venue/locality address shape", () => {
    const base = { title: "Founders event", date: { when: "Oct 20, 6:00 PM" }, ticket_info: [{ link: "https://example.com/event" }], venue: { name: "Moscone Center" }, address: ["Moscone Center", "San Francisco, CA"] };
    const record = normalizeSerpEvent(base, now)!;
    expect(record.opportunity).toMatchObject({ area: "sf", location: "Moscone Center · San Francisco, CA" });
    expect(filterOpportunities([{ ...record.opportunity, _id: "sf-event", saved: false, updatedAt: now }], defaultOpportunityFilters)).toHaveLength(1);
    expect(normalizeSerpEvent({ ...base, address: ["San Francisco Conference Center", "South San Francisco, CA"] }, now)!.opportunity.area).toBe("bay-area");
    expect(normalizeSerpEvent({ ...base, address: ["San Francisco Club", "New York, NY"] }, now)).toBeNull();
    expect(normalizeSerpEvent({ ...base, addressCity: "San Francisco", addressRegion: "CA", address: [] }, now)!.opportunity.area).toBe("sf");
  });
});
describe("Stage 6 persistence and authorization", () => {
  it("authorizes all organizer operations, validates limits, and requires provider configuration", async () => {
    const { t, identity, organizer, profile } = await setup(); const outsider = await identity("outsider@example.com");
    for (const c of [t, outsider, await identity("unverified@example.com", false)]) {
      await expect(c.query(api.ingestion.status, {})).rejects.toThrow();
      await expect(c.mutation(api.ingestion.refresh, { provider: "luma" })).rejects.toThrow();
      await expect(c.mutation(api.ingestion.configure, { provider: "luma", enabled: true, autoPublish: false })).rejects.toThrow();
      await expect(c.mutation(api.ingestion.importYc, { csv: validCsv })).rejects.toThrow();
    }
    await expect(organizer.mutation(api.ingestion.configure, { provider: "serpapi", enabled: true, monthlyLimit: 201, autoPublish: false })).rejects.toThrow();
    vi.stubEnv("SERPAPI_API_KEY", "");
    await expect(organizer.mutation(api.ingestion.configure, { provider: "serpapi", enabled: true, monthlyLimit: 200, autoPublish: false })).rejects.toThrow("provider's key");
    await expect(organizer.mutation(api.ingestion.configure, { provider: "luma", enabled: true, feedUrl: "https://example.com/feed.ics", autoPublish: false })).rejects.toThrow("subscription URL");
    await t.run((ctx) => ctx.db.patch(profile._id, { suspended: true }));
    await expect(organizer.query(api.ingestion.status, {})).rejects.toThrow("access");
  });
  it("deduplicates repeat imports by ID and cross-provider URLs, retaining curation and publication choices", async () => {
    const { t, organizer, imported, configure, run } = await setup(); const entry = await imported();
    const input = opportunitySchema.parse({ ...entry, title: "Organizer's better title", status: "published", organizerPick: true });
    await organizer.mutation(api.opportunities.save, { opportunityId: entry._id, expectedUpdatedAt: entry.updatedAt, opportunity: input });
    vi.setSystemTime(now + DAY);
    const runId = await run(); const changed = record(); changed.sourceId = "provider-updated-id"; changed.opportunity.location = "New venue, San Francisco"; changed.opportunity.title = "Provider's renamed event";
    await t.mutation(internal.ingestion.complete, { runId, records: [changed, changed], skipped: 0 });
    let entries = (await organizer.query(api.opportunities.list, { management: true })).entries;
    expect(entries).toHaveLength(1); expect(entries[0]).toMatchObject({ title: input.title, location: changed.opportunity.location, status: "published", organizerPick: true });
    expect(entries[0].updatedAt).toBeGreaterThan(entry.updatedAt);
    await configure("serpapi"); const crossRun = await run("serpapi");
    await t.mutation(internal.ingestion.complete, { runId: crossRun, records: [{ ...record(), sourceId: "google-other", opportunity: { ...record().opportunity, title: "Other provider title" } }], skipped: 0 });
    entries = (await organizer.query(api.opportunities.list, { management: true })).entries;
    expect(entries).toHaveLength(1); expect(entries[0].title).toBe(input.title);
    const sources = await organizer.query(api.ingestion.provenance, { opportunityId: entry._id }); expect(sources).toHaveLength(2);
    expect(sources[0].snapshot.title).toBe(changed.opportunity.title);
    await organizer.mutation(api.ingestion.restoreFields, { opportunityId: entry._id, expectedUpdatedAt: entries[0].updatedAt });
    expect((await organizer.query(api.opportunities.list, { management: true })).entries[0]).toMatchObject({ title: changed.opportunity.title, status: "published", organizerPick: true });
  });
  it("leaves unchanged repeats and Sprint snapshots stable, flags changed/cancelled sources and blocks new scheduling", async () => {
    const { t, organizer, imported, run, profile } = await setup(); const entry = await imported();
    const cohortId = await organizer.mutation(api.cohorts.create, { name: "Pilot", description: "", startDate: "2026-10-18" });
    await t.run((ctx) => ctx.db.insert("memberships", { cohortId, profileId: profile._id, status: "active" }));
    const published = opportunitySchema.parse({ ...entry, status: "published" });
    await organizer.mutation(api.opportunities.save, { opportunityId: entry._id, expectedUpdatedAt: entry.updatedAt, opportunity: published });
    const current = (await organizer.query(api.opportunities.list, { management: true })).entries[0];
    const activityInput = { title: entry.title, kind: "event" as const, startAt: entry.startAt, endAt: entry.endAt, location: entry.location, notes: "" };
    await organizer.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", expectedRevision: 0, expectedProgressRevision: 0, opportunityId: entry._id, input: activityInput });
    vi.setSystemTime(now + DAY); const repeatRun = await run();
    await t.mutation(internal.ingestion.complete, { runId: repeatRun, records: [record()], skipped: 0 });
    expect((await organizer.query(api.opportunities.list, { management: true })).entries[0].updatedAt).toBe(current.updatedAt);
    expect((await organizer.query(api.sprint.get, { cohortId })).entries[0].sourceChanged).toBe(false);
    vi.setSystemTime(now + 2 * DAY); const changedRun = await run();
    await t.mutation(internal.ingestion.complete, { runId: changedRun, records: [{ ...record(), cancelled: true }], skipped: 0 });
    const cancelled = (await organizer.query(api.opportunities.list, { management: true })).entries[0];
    expect(cancelled.sourceCancelled).toBe(true); expect(cancelled.updatedAt).toBeGreaterThan(current.updatedAt);
    expect((await organizer.query(api.sprint.get, { cohortId })).entries[0]).toMatchObject({ title: entry.title, startAt: entry.startAt, sourceChanged: true, sourceUnavailable: true });
    await expect(organizer.mutation(api.sprint.saveActivity, { cohortId, scope: "personal", expectedRevision: 0, expectedProgressRevision: 0, opportunityId: entry._id, input: activityInput })).rejects.toThrow("cancelled");
    vi.setSystemTime(now + 3 * DAY); const missingStatusRun = await run();
    await t.mutation(internal.ingestion.complete, { runId: missingStatusRun, records: [record()], skipped: 0 });
    expect((await organizer.query(api.opportunities.list, { management: true })).entries[0].sourceCancelled).toBe(true);
  });
  it("reserves allowances transactionally across races and manual/scheduled attempts, with no failure refunds", async () => {
    const { t, organizer, configure, run } = await setup(); await configure("serpapi", 2);
    const results = await Promise.allSettled([organizer.mutation(api.ingestion.refresh, { provider: "serpapi" }), organizer.mutation(api.ingestion.refresh, { provider: "serpapi" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const runId = results.find((r) => r.status === "fulfilled")!.value!;
    await t.mutation(internal.ingestion.fail, { runId, error: "Provider failed" });
    vi.setSystemTime(now + DAY);
    await expect(run("serpapi")).rejects.toThrow("allowance is exhausted");
    await t.mutation(internal.ingestion.scheduled, {});
    expect((await organizer.query(api.ingestion.status, {})).sources[1].reserved).toBe(2);
    expect(await t.run((ctx) => ctx.db.query("opportunities").collect())).toHaveLength(0);
    vi.setSystemTime(Date.parse("2026-11-01T12:00:00Z"));
    expect(await run("serpapi")).toBeTruthy();
  });
  it("allows immediate Luma refreshes after completion or failure while retaining active-run and Google Events limits", async () => {
    const { t, organizer, configure, run } = await setup(); await configure();
    const first = await organizer.mutation(api.ingestion.refresh, { provider: "luma" });
    await expect(organizer.mutation(api.ingestion.refresh, { provider: "luma" })).rejects.toThrow("already running");
    await t.mutation(internal.ingestion.claim, { runId: first! });
    await expect(organizer.mutation(api.ingestion.refresh, { provider: "luma" })).rejects.toThrow("already running");
    await t.mutation(internal.ingestion.complete, { runId: first!, records: [record()], skipped: 0 });
    const second = await run();
    expect(second).not.toBe(first);
    await t.mutation(internal.ingestion.fail, { runId: second, error: "Provider unavailable" });
    await t.mutation(internal.ingestion.scheduled, {});
    expect((await organizer.query(api.ingestion.status, {})).runs).toHaveLength(2);
    expect(await run()).toBeTruthy();

    await configure("serpapi");
    const paid = await run("serpapi");
    await t.mutation(internal.ingestion.fail, { runId: paid, error: "Provider unavailable" });
    await expect(run("serpapi")).rejects.toThrow("once per hour");
  });
  it("selects daily/weekly cadence, claims work once, and expires stuck imports", async () => {
    const { t, organizer, configure } = await setup(); await configure();
    expect((await organizer.query(api.ingestion.status, {})).intervalDays).toBe(7);
    await organizer.mutation(api.cohorts.create, { name: "Pilot", description: "", startDate: "2026-10-18" });
    expect((await organizer.query(api.ingestion.status, {})).intervalDays).toBe(1);
    await t.mutation(internal.ingestion.scheduled, {});
    const first = (await organizer.query(api.ingestion.status, {})).runs[0];
    expect(await t.mutation(internal.ingestion.claim, { runId: first._id })).toBeTruthy();
    expect(await t.mutation(internal.ingestion.claim, { runId: first._id })).toBeNull();
    vi.setSystemTime(now + 21 * 60_000); await t.mutation(internal.ingestion.expire, { runId: first._id });
    expect((await organizer.query(api.ingestion.status, {})).runs[0].status).toBe("failed");
    await t.mutation(internal.ingestion.scheduled, {}); expect((await organizer.query(api.ingestion.status, {})).runs).toHaveLength(1);
    vi.setSystemTime(now + DAY); await t.mutation(internal.ingestion.scheduled, {}); expect((await organizer.query(api.ingestion.status, {})).runs).toHaveLength(2);
  });
  it("imports YC atomically, keeps drafts private, and preserves edits on repeat CSVs", async () => {
    const { t, organizer } = await setup();
    await expect(organizer.mutation(api.ingestion.importYc, { csv: validCsv + '\ninvalid,row' })).rejects.toThrow("Row 3");
    expect(await t.run((ctx) => ctx.db.query("opportunities").collect())).toHaveLength(0);
    expect(await organizer.mutation(api.ingestion.importYc, { csv: validCsv })).toEqual({ added: 1, updated: 0, skipped: 0 });
    const entry = (await organizer.query(api.opportunities.list, { management: true })).entries[0];
    await organizer.mutation(api.opportunities.save, { opportunityId: entry._id, expectedUpdatedAt: entry.updatedAt, opportunity: opportunitySchema.parse({ ...entry, summary: "Organizer's helpful company summary" }) });
    await organizer.mutation(api.ingestion.importYc, { csv: validCsv.replace("A useful directory listing", "A different company summary") });
    const entries = (await organizer.query(api.opportunities.list, { management: true })).entries;
    expect(entries).toHaveLength(1); expect(entries[0].summary).toBe("Organizer's helpful company summary"); expect(entries[0].status).toBe("draft");
  });
  it("fetches a Luma calendar without a key or charge reservation and publishes only when configured", async () => {
    const { t, organizer, configure } = await setup(); await configure("luma", 200, true);
    const imageUrl = "https://images.lumacdn.com/uploads/builders.png";
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(lumaCalendar())).mockResolvedValueOnce(new Response(`<meta property="og:image" content="${imageUrl}">`)); vi.stubGlobal("fetch", fetcher);
    const runId = (await organizer.mutation(api.ingestion.refresh, { provider: "luma" }))!;
    await t.action(internal.ingestionActions.execute, { runId });
    expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe("api.luma.com");
    expect(fetcher.mock.calls[0][1].headers).toEqual({ Accept: "text/calendar" });
    expect(fetcher.mock.calls[1][0]).toBe("https://luma.com/builders");
    await t.action(internal.ingestionActions.execute, { runId }); expect(fetcher).toHaveBeenCalledTimes(2);
    const entries = (await organizer.query(api.opportunities.list, { management: true })).entries;
    expect(entries).toHaveLength(1); expect(entries[0].status).toBe("published"); expect(entries[0].cost).toBe("unknown"); expect(entries[0].imageUrl).toBe(imageUrl);
    const status = await organizer.query(api.ingestion.status, {});
    expect(status.runs[0]).toMatchObject({ status: "succeeded", added: 1, reservation: 0 });
    expect(status.sources[0].feedUrl).toBe(DEFAULT_LUMA_FEED_URL);

    // Ordinary organizer edits and an unavailable artwork page must preserve the existing image.
    await organizer.mutation(api.opportunities.save, { opportunityId: entries[0]._id, expectedUpdatedAt: entries[0].updatedAt, opportunity: opportunitySchema.parse({ ...entries[0], title: "Organizer's event title" }) });
    vi.setSystemTime(now + DAY);
    fetcher.mockResolvedValueOnce(new Response(lumaCalendar())).mockRejectedValueOnce(new Error("Page unavailable"));
    const refreshId = (await organizer.mutation(api.ingestion.refresh, { provider: "luma" }))!;
    await t.action(internal.ingestionActions.execute, { runId: refreshId });
    const refreshed = (await organizer.query(api.opportunities.list, { management: true })).entries[0];
    expect(refreshed).toMatchObject({ imageUrl, title: "Organizer's event title" });
    expect((await organizer.query(api.ingestion.status, {})).runs[0].status).toBe("succeeded");
  });
  it("preserves the catalog on malformed feeds and applies UID-only cancellations without deleting Sprint snapshots", async () => {
    const { t, organizer, imported } = await setup(); const entry = await imported();
    vi.setSystemTime(now + DAY);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Unavailable</html>")));
    let runId = (await organizer.mutation(api.ingestion.refresh, { provider: "luma" }))!;
    await t.action(internal.ingestionActions.execute, { runId });
    expect((await organizer.query(api.ingestion.status, {})).runs[0].status).toBe("failed");
    expect((await organizer.query(api.opportunities.list, { management: true })).entries[0].updatedAt).toBe(entry.updatedAt);
    vi.setSystemTime(now + 2 * DAY);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(lumaCalendar(["BEGIN:VEVENT\r\nUID:evt-builders@events.lu.ma\r\nSTATUS:CANCELLED\r\nEND:VEVENT"]))));
    runId = (await organizer.mutation(api.ingestion.refresh, { provider: "luma" }))!;
    await t.action(internal.ingestionActions.execute, { runId });
    expect((await organizer.query(api.opportunities.list, { management: true })).entries[0]).toMatchObject({ sourceCancelled: true, title: entry.title, startAt: entry.startAt });
  });
  it("bounds SerpApi calls and preserves existing listings when a provider fails without exposing its error payload", async () => {
    const { t, organizer, imported, configure } = await setup(); const entry = await imported(); await configure("serpapi");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ events_results: [{ title: "Founders gathering", date: { when: "Oct 20, 6:00 PM" }, address: ["San Francisco"], ticket_info: [{ link: "https://example.com/event" }] }] }))
      .mockResolvedValueOnce(Response.json({ error: "key=test-serp-key" }, { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const runId = (await organizer.mutation(api.ingestion.refresh, { provider: "serpapi" }))!;
    await t.action(internal.ingestionActions.execute, { runId }); expect(fetcher).toHaveBeenCalledTimes(2);
    const runs = (await organizer.query(api.ingestion.status, {})).runs;
    expect(runs.find((r) => r._id === runId)).toMatchObject({ status: "failed", reservation: 2, added: 0 });
    expect(JSON.stringify(runs)).not.toContain("test-serp-key");
    const entries = (await organizer.query(api.opportunities.list, { management: true })).entries;
    expect(entries).toHaveLength(1); expect(entries[0].updatedAt).toBe(entry.updatedAt);
  });
});
