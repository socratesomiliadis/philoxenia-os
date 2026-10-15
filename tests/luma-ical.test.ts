import { describe, expect, it } from "vitest";
import { parseLumaCalendar } from "../lib/luma-ical";
import { DEFAULT_LUMA_FEED_URL, lumaFeedUrl } from "../lib/ingestion";
import { activityFromOpportunity } from "../lib/sprint";
import { defaultOpportunityFilters, filterOpportunities, opportunitySchema, opportunityTimeLabel } from "../lib/opportunities";
import { lumaCalendar, lumaEvent } from "./fixtures/luma-calendar";

const now = Date.parse("2026-10-15T12:00:00Z");
describe("Luma iCal import", () => {
  it("unfolds and unescapes descriptions, extracts Luma registration links, and keeps price/approval unknown", () => {
    const input = lumaEvent.replace("AI builders meetup", "AI builders\\, demos & feedback").replace("share product feedback.", "share product\\nfeedback\\, toge\r\n ther.");
    const result = parseLumaCalendar(lumaCalendar([input]), now);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ sourceId: "evt-builders@events.lu.ma", canonicalUrl: "https://luma.com/builders", opportunity: { title: "AI builders, demos & feedback", cost: "unknown", location: "San Francisco · venue not announced", startAt: Date.parse("2026-10-20T01:00:00Z"), endAt: Date.parse("2026-10-20T03:00:00Z") } });
    expect(result.records[0].approvalRequired).toBeUndefined();
    expect(result.records[0].opportunity.description).toContain("product\nfeedback, together.");
    expect(result.records[0].opportunity.summary).not.toContain("Get up-to-date");
  });
  it("uses UID revisions and explicit cancellations while rejecting unsupported recurrence instances", () => {
    const cancelled = lumaEvent.replace("SEQUENCE:1", "SEQUENCE:2").replace("STATUS:TENTATIVE", "STATUS:CANCELLED");
    const result = parseLumaCalendar(lumaCalendar([cancelled, lumaEvent]), now);
    expect(result.records).toHaveLength(1); expect(result.records[0].cancelled).toBe(true); expect(result.cancellations).toEqual(["evt-builders@events.lu.ma"]);
    const recurring = lumaEvent.replace("SEQUENCE:1", "RRULE:FREQ=DAILY;COUNT=500000");
    expect(parseLumaCalendar(lumaCalendar([recurring]), now).records).toHaveLength(0);
    expect(parseLumaCalendar(lumaCalendar([lumaEvent.replace("SEQUENCE:1", "RECURRENCE-ID:20261020T010000Z")]), now).cancellations).toHaveLength(0);
  });
  it("retains all-day and multi-day calendar dates, filters correctly, and creates an untimed Sprint task", () => {
    const input = lumaEvent.replace("DTSTART:20261020T010000Z", "DTSTART;VALUE=DATE:20261020").replace("DTEND:20261020T030000Z", "DTEND;VALUE=DATE:20261023");
    const record = parseLumaCalendar(lumaCalendar([input]), now).records[0];
    expect(record.opportunity).toMatchObject({ eventDate: "2026-10-20", eventEndDate: "2026-10-23" }); expect(record.opportunity.startAt).toBeUndefined();
    expect(opportunityTimeLabel(record.opportunity)).toBe("Oct 20, 2026 – Oct 22, 2026 · All day");
    const opportunity = { ...record.opportunity, _id: "all-day", saved: false, updatedAt: now };
    expect(filterOpportunities([opportunity], { ...defaultOpportunityFilters, from: "2026-10-20", to: "2026-10-20" })).toHaveLength(1);
    expect(activityFromOpportunity(opportunity)).toMatchObject({ kind: "task", day: "2026-10-20" }); expect(activityFromOpportunity(opportunity).startAt).toBeUndefined();
    expect(opportunitySchema.safeParse({ ...record.opportunity, startAt: now }).success).toBe(false);
  });
  it("resolves SF timezone dates across DST and skips ambiguous/floating dates, missing links and out-of-window events", () => {
    const sf = lumaEvent.replace("DTSTART:20261020T010000Z", "DTSTART;TZID=America/Los_Angeles:20261102T180000").replace("DTEND:20261020T030000Z", "DTEND;TZID=America/Los_Angeles:20261102T200000");
    expect(parseLumaCalendar(lumaCalendar([sf]), now).records[0].opportunity.startAt).toBe(Date.parse("2026-11-03T02:00:00Z"));
    for (const input of [sf.replace("20261102T180000", "20261101T013000"), lumaEvent.replace("20261020T010000Z", "20261020T010000"), lumaEvent.replace("https://lu.ma/builders?utm_source=test", "https://example.com/other"), lumaEvent.replace("20261020T010000Z", "20270101T010000Z")]) expect(parseLumaCalendar(lumaCalendar([input]), now).records).toHaveLength(0);
  });
  it("bounds the feed and accepted records, rejecting malformed calendars and unsafe subscription URLs", () => {
    expect(() => parseLumaCalendar("<html>No calendar</html>", now)).toThrow();
    expect(() => parseLumaCalendar("BEGIN:VCALENDAR\n" + "x".repeat(2_000_000), now)).toThrow();
    const result = parseLumaCalendar(lumaCalendar(Array.from({ length: 55 }, (_, i) => lumaEvent.replace("evt-builders@", `evt-${i}@`))), now);
    expect(result.records).toHaveLength(50); expect(result.skipped).toBe(5);
    expect(lumaFeedUrl(DEFAULT_LUMA_FEED_URL.replace("https:", "webcal:").replace("api.luma.com", "api.lu.ma"))).toBe(DEFAULT_LUMA_FEED_URL);
    for (const url of ["https://127.0.0.1/feed.ics", "https://api.luma.com.evil.example/ics/get?entity=discover&id=sf", DEFAULT_LUMA_FEED_URL + "&redirect=https://example.com", DEFAULT_LUMA_FEED_URL.replace("entity=discover", "entity=user"), DEFAULT_LUMA_FEED_URL.replace("https:", "http:")]) expect(() => lumaFeedUrl(url)).toThrow();
  });
});
