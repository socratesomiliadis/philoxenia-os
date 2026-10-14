import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { answersValidator, fallbackValidator, goalValidator, sourceValidator } from "./missionValidators";

export default defineSchema({
  onboarding: defineTable({
    profileId: v.id("profiles"), cohortId: v.id("cohorts"),
    answers: answersValidator, step: v.number(), revision: v.number(), updatedAt: v.number(),
    proposal: v.optional(v.array(goalValidator)), source: v.optional(sourceValidator),
    fallbackReason: v.optional(fallbackValidator), generationId: v.optional(v.string()),
    confirmedGoals: v.optional(v.array(goalValidator)), confirmedAt: v.optional(v.number()),
  }).index("by_profile_cohort", ["profileId", "cohortId"]),
  missionGenerationLimits: defineTable({
    profileId: v.id("profiles"), windowStart: v.number(), count: v.number(), lastAttempt: v.number(),
  }).index("by_profile", ["profileId"]),
  profiles: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    isAlumni: v.boolean(),
    suspended: v.boolean(),
  }).index("by_auth_user", ["authUserId"]).index("by_email", ["email"]),
  cohorts: defineTable({
    name: v.string(),
    description: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    timezone: v.literal("America/Los_Angeles"),
    status: v.union(v.literal("upcoming"), v.literal("active"), v.literal("completed")),
    createdBy: v.id("profiles"),
  }),
  memberships: defineTable({
    profileId: v.id("profiles"),
    cohortId: v.id("cohorts"),
    status: v.union(v.literal("active"), v.literal("revoked")),
    startDateOverride: v.optional(v.string()),
    endDateOverride: v.optional(v.string()),
  }).index("by_profile", ["profileId"]).index("by_cohort", ["cohortId"])
    .index("by_profile_cohort", ["profileId", "cohortId"]),
  invitations: defineTable({
    email: v.string(),
    name: v.string(),
    cohortId: v.id("cohorts"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    invitedBy: v.id("profiles"),
    acceptedBy: v.optional(v.id("profiles")),
  }).index("by_email", ["email"]).index("by_cohort", ["cohortId"])
    .index("by_email_cohort", ["email", "cohortId"]),
});
