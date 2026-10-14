import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { answersValidator, fallbackValidator, goalValidator, sourceValidator } from "./missionValidators";
import { opportunityFields } from "./opportunityValidators";
import { activityFields, progressFields, outcomeFields } from "./sprintValidators";
import { offerFields, communityFields, requestStatus } from "./openDoorsValidators";

export default defineSchema({
  alumniOffers: defineTable({ ...offerFields, ownerId: v.id("profiles"), revision: v.number(), updatedAt: v.number() })
    .index("by_published", ["published"]).index("by_owner", ["ownerId"]),
  supportRequests: defineTable({
    offerId: v.id("alumniOffers"), requesterId: v.id("profiles"), alumnusId: v.id("profiles"), cohortId: v.id("cohorts"),
    goal: v.string(), fit: v.string(), offerSnapshot: v.object(offerFields), status: requestStatus,
    response: v.optional(v.string()), alternative: v.optional(v.string()), revision: v.number(), updatedAt: v.number(),
    activityId: v.optional(v.id("sprintActivities")), completedBy: v.optional(v.id("profiles")),
  }).index("by_requester", ["requesterId"]).index("by_alumnus", ["alumnusId"])
    .index("by_offer", ["offerId"]).index("by_requester_offer", ["requesterId", "offerId"]),
  supportCoordination: defineTable({ requestId: v.id("supportRequests"), organizerId: v.id("profiles"), note: v.string(), updatedAt: v.number() })
    .index("by_request", ["requestId"]),
  notifications: defineTable({ profileId: v.id("profiles"), message: v.string(), requestId: v.optional(v.id("supportRequests")), createdAt: v.number(), readAt: v.optional(v.number()) })
    .index("by_profile", ["profileId"]),
  emailDeliveries: defineTable({
    profileId: v.optional(v.id("profiles")), invitationId: v.optional(v.id("invitations")), requestId: v.optional(v.id("supportRequests")),
    email: v.string(), message: v.string(), path: v.string(), status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"), v.literal("disabled")),
    attempts: v.number(), updatedAt: v.number(), error: v.optional(v.string()), providerId: v.optional(v.string()),
  }).index("by_profile", ["profileId"]).index("by_invitation", ["invitationId"]).index("by_request", ["requestId"]),
  sprintActivities: defineTable({
    ...activityFields, cohortId: v.id("cohorts"), ownerId: v.optional(v.id("profiles")),
    scope: v.union(v.literal("personal"), v.literal("cohort")), createdBy: v.id("profiles"),
    revision: v.number(), updatedAt: v.number(), cancelledAt: v.optional(v.number()),
    opportunityId: v.optional(v.id("opportunities")), sourceUrl: v.optional(v.string()), sourceUpdatedAt: v.optional(v.number()),
    supportRequestId: v.optional(v.id("supportRequests")),
  }).index("by_cohort_scope", ["cohortId", "scope"]).index("by_owner_cohort", ["ownerId", "cohortId"])
    .index("by_owner_cohort_opportunity", ["ownerId", "cohortId", "opportunityId"]),
  sprintProgress: defineTable({
    ...progressFields, profileId: v.id("profiles"), cohortId: v.id("cohorts"), activityId: v.id("sprintActivities"),
    revision: v.number(), updatedAt: v.number(), activityRevision: v.number(), completedAt: v.optional(v.number()),
  }).index("by_profile_cohort", ["profileId", "cohortId"]).index("by_profile_activity", ["profileId", "activityId"])
    .index("by_activity", ["activityId"]),
  sprintOutcomes: defineTable({
    ...outcomeFields, profileId: v.id("profiles"), cohortId: v.id("cohorts"), activityId: v.optional(v.id("sprintActivities")), updatedAt: v.number(),
  }).index("by_profile_cohort", ["profileId", "cohortId"]).index("by_activity", ["activityId"]),
  opportunities: defineTable({
    ...opportunityFields,
    createdBy: v.id("profiles"), updatedAt: v.number(), supportConfirmedAt: v.optional(v.number()),
  }).index("by_status", ["status"]).index("by_kind_source", ["kind", "sourceUrl"]),
  bookmarks: defineTable({
    profileId: v.id("profiles"), opportunityId: v.id("opportunities"),
  }).index("by_profile", ["profileId"]).index("by_profile_opportunity", ["profileId", "opportunityId"]),
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
    community: v.optional(v.object(communityFields)),
    graduatedAt: v.optional(v.number()), graduatedBy: v.optional(v.id("profiles")),
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
    .index("by_email_cohort", ["email", "cohortId"]).index("by_accepted_profile", ["acceptedBy"]),
});
