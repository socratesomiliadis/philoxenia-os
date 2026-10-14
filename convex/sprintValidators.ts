import { v } from "convex/values";

export const goalLinkValidator = v.object({ missionConfirmedAt: v.number(), index: v.number() });
export const activityFields = {
  kind: v.union(v.literal("task"), v.literal("event"), v.literal("meeting"), v.literal("challenge")),
  title: v.string(), notes: v.string(), location: v.string(), day: v.optional(v.string()),
  startAt: v.optional(v.number()), endAt: v.optional(v.number()),
};
export const progressFields = { status: v.union(v.literal("planned"), v.literal("completed"), v.literal("skipped")), goalLink: v.optional(goalLinkValidator), contribution: v.number() };
export const outcomeFields = {
  type: v.union(v.literal("meeting"), v.literal("feedback"), v.literal("project"), v.literal("internship"), v.literal("funding"), v.literal("other")),
  title: v.string(), notes: v.string(), date: v.string(), quantity: v.number(),
};
