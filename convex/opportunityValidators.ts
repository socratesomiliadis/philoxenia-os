import { v } from "convex/values";

export const kindValidator = v.union(v.literal("event"), v.literal("startup"), v.literal("founder"), v.literal("alumni"));
export const opportunityFields = {
  kind: kindValidator,
  title: v.string(), summary: v.string(), description: v.string(),
  interests: v.array(v.string()),
  categories: v.array(v.union(v.literal("connect"), v.literal("feedback"), v.literal("learn"), v.literal("give-back"))),
  area: v.union(v.literal("sf"), v.literal("bay-area"), v.literal("online")),
  location: v.string(), sourceName: v.string(), sourceUrl: v.string(), organizerPick: v.boolean(),
  status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
  startAt: v.optional(v.number()), endAt: v.optional(v.number()),
  eventDate: v.optional(v.string()), eventEndDate: v.optional(v.string()),
  cost: v.optional(v.union(v.literal("free"), v.literal("paid"), v.literal("unknown"))), costNote: v.optional(v.string()),
  support: v.optional(v.object({ offeredBy: v.string(), pathway: v.string(), url: v.string(), availability: v.string() })),
};
