import { v } from "convex/values";

export const offerFields = {
  kind: v.union(v.literal("mentorship"), v.literal("portfolio"), v.literal("introduction"), v.literal("other")),
  title: v.string(), description: v.string(), availability: v.string(), capacity: v.number(), connection: v.string(), published: v.boolean(),
};
export const communityFields = { bio: v.string(), building: v.string(), interests: v.string(), offering: v.string() };
export const requestStatus = v.union(v.literal("pending"), v.literal("alternative"), v.literal("agreed"), v.literal("declined"), v.literal("withdrawn"), v.literal("completed"));
