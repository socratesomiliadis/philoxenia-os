import { describe, expect, it } from "vitest";
import { homeSprintSummary, homeStayProgress } from "../lib/home-dashboard";
import { sampleSprintData } from "../lib/sample-sprint";
import { parseSfDateTime } from "../lib/opportunities";

describe("home widgets", () => {
  it("orders the next three activities and keeps undated tasks out of the agenda", () => {
    const summary = homeSprintSummary(sampleSprintData, parseSfDateTime("2026-11-02T09:00"));
    expect(summary.upcoming.map((entry) => entry._id)).toEqual(["sample-welcome", "sample-pitch", "sample-meeting"]);
    expect(summary.flexible).toBe(1);
    expect(summary.planned).toBe(5);
  });

  it("keeps ongoing meetings visible and removes them at their end time", () => {
    expect(homeSprintSummary(sampleSprintData, parseSfDateTime("2026-11-02T10:30")).upcoming[0]._id).toBe("sample-welcome");
    expect(homeSprintSummary(sampleSprintData, parseSfDateTime("2026-11-02T11:00")).upcoming.some((entry) => entry._id === "sample-welcome")).toBe(false);
  });

  it("excludes cancelled, skipped, completed, and out-of-stay activities from up next", () => {
    const data = { ...sampleSprintData, entries: sampleSprintData.entries.map((entry, i) => i === 0 ? { ...entry, cancelledAt: 1 } : i === 1 ? { ...entry, progress: { ...entry.progress, status: "completed" as const } } : i === 2 ? { ...entry, progress: { ...entry.progress, status: "skipped" as const } } : { ...entry, day: "2026-11-20" }) };
    const summary = homeSprintSummary(data, parseSfDateTime("2026-11-02T09:00"));
    expect(summary.upcoming).toEqual([]);
    expect(summary.completed).toBe(1);
    expect(summary.planned).toBe(0);
  });

  it("uses the stay dates returned for the individual participant", () => {
    const summary = homeSprintSummary({ ...sampleSprintData, startDate: "2026-11-03", endDate: "2026-11-16" }, parseSfDateTime("2026-11-02T09:00"));
    expect(summary.upcoming.map((entry) => entry._id)).toEqual(["sample-meeting", "sample-challenge"]);
  });

  it("counts outcome quantities and shows no future agenda after the stay", () => {
    const summary = homeSprintSummary({ ...sampleSprintData, outcomes: [{ _id: "result", title: "Feedback conversations", type: "feedback", notes: "", date: "2026-11-03", quantity: 3, updatedAt: 1 }] }, parseSfDateTime("2026-11-16T09:00"));
    expect(summary.outcomes).toBe(3);
    expect(summary.upcoming).toEqual([]);
  });

  it("tracks arrival, the SF calendar day, and completion across daylight saving", () => {
    const stay = (time: string) => homeStayProgress("2026-10-25", "2026-11-07", parseSfDateTime(time));
    expect(stay("2026-10-24T23:59").label).toBe("1 day until arrival");
    expect(stay("2026-10-25T00:00").label).toBe("Day 1 of 14");
    expect(stay("2026-11-01T23:59").label).toBe("Day 8 of 14");
    expect(stay("2026-11-07T23:59").label).toBe("Day 14 of 14");
    expect(stay("2026-11-08T00:00").elapsed).toBe(14);
    expect(stay("2026-11-08T00:00").label).toBe("Stay complete");
  });
});
