import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember, requireOrganizer } from "./access";
import { activityFields, goalLinkValidator, outcomeFields, progressFields } from "./sprintValidators";
import { activitySchema, assertInStay, emptyProgress, goalLinkSchema, overlapping, outcomeSchema, progressSchema, type GoalLink, type SprintData, type SprintEntry, type SprintProgress } from "../lib/sprint";

type Ctx = QueryCtx | MutationCtx;
async function ownStay(ctx: Ctx, cohortId: Id<"cohorts">) {
  const member = await requireMember(ctx);
  const membership = member.memberships.find((item) => item.cohortId === cohortId && item.status === "active");
  const cohort = await ctx.db.get(cohortId);
  if (!membership || !cohort) throw new ConvexError("An active membership in this cohort is required to plan a personal Sprint.");
  return { member, cohort, startDate: membership.startDateOverride ?? cohort.startDate, endDate: membership.endDateOverride ?? cohort.endDate };
}
function checkDates(input: Parameters<typeof assertInStay>[0], startDate: string, endDate: string) {
  try { assertInStay(input, startDate, endDate); }
  catch (error) { throw new ConvexError((error as Error).message); }
}
async function checkGoal(ctx: Ctx, profileId: Id<"profiles">, cohortId: Id<"cohorts">, goal?: GoalLink) {
  if (!goal) return;
  const valid = goalLinkSchema.safeParse(goal);
  const mission = await ctx.db.query("onboarding").withIndex("by_profile_cohort", (q) => q.eq("profileId", profileId).eq("cohortId", cohortId)).unique();
  if (!valid.success || mission?.confirmedAt !== goal.missionConfirmedAt || !mission.confirmedGoals?.[goal.index]) throw new ConvexError("Your confirmed mission changed. Reopen this activity and choose a current goal.");
}
async function participation(ctx: Ctx, profileId: Id<"profiles">, activityId: Id<"sprintActivities">) {
  return ctx.db.query("sprintProgress").withIndex("by_profile_activity", (q) => q.eq("profileId", profileId).eq("activityId", activityId)).unique();
}
function progressView(progress?: Doc<"sprintProgress">): SprintProgress {
  return progress ? { status: progress.status, contribution: progress.contribution, goalLink: progress.goalLink, revision: progress.revision, updatedAt: progress.updatedAt, activityRevision: progress.activityRevision, completedAt: progress.completedAt } : { ...emptyProgress };
}
async function entriesFor(ctx: Ctx, cohortId: Id<"cohorts">, profileId: Id<"profiles">, management = false): Promise<SprintEntry[]> {
  const [personal, shared, progress] = await Promise.all([
    management ? [] : ctx.db.query("sprintActivities").withIndex("by_owner_cohort", (q) => q.eq("ownerId", profileId).eq("cohortId", cohortId)).collect(),
    ctx.db.query("sprintActivities").withIndex("by_cohort_scope", (q) => q.eq("cohortId", cohortId).eq("scope", "cohort")).collect(),
    management ? [] : ctx.db.query("sprintProgress").withIndex("by_profile_cohort", (q) => q.eq("profileId", profileId).eq("cohortId", cohortId)).collect(),
  ]);
  const progressMap = new Map(progress.map((item) => [item.activityId, item]));
  return Promise.all([...personal, ...shared].map(async (activity) => {
    const source = activity.opportunityId ? await ctx.db.get(activity.opportunityId) : null;
    return { _id: activity._id, scope: activity.scope, kind: activity.kind, title: activity.title, notes: activity.notes, location: activity.location,
      day: activity.day, startAt: activity.startAt, endAt: activity.endAt, revision: activity.revision, updatedAt: activity.updatedAt, cancelledAt: activity.cancelledAt,
      opportunityId: activity.opportunityId, sourceUrl: activity.sourceUrl,
      sourceChanged: !!source && source.updatedAt !== activity.sourceUpdatedAt, sourceUnavailable: !!activity.opportunityId && (!source || source.status !== "published"),
      progress: progressView(progressMap.get(activity._id)), calendarUid: `${activity._id}.${profileId}@philoxenia.hustlehours.com`,
    };
  }));
}
async function ownActivity(ctx: Ctx, activityId: Id<"sprintActivities">) {
  const activity = await ctx.db.get(activityId);
  if (!activity) throw new ConvexError("This activity was removed. Close this view and refresh your Sprint.");
  const stay = await ownStay(ctx, activity.cohortId);
  if (activity.scope === "personal" && activity.ownerId !== stay.member.profile._id) throw new ConvexError("You can only change your own Sprint.");
  return { ...stay, activity };
}

export const get = query({
  args: { cohortId: v.id("cohorts"), profileId: v.optional(v.id("profiles")) },
  handler: async (ctx, args): Promise<SprintData> => {
    const member = await requireMember(ctx);
    const profileId = args.profileId ?? member.profile._id;
    const readOnly = profileId !== member.profile._id;
    if (readOnly && !member.isOrganizer) throw new ConvexError("You can only view your own Sprint.");
    const [cohort, membership, target] = await Promise.all([
      ctx.db.get(args.cohortId),
      ctx.db.query("memberships").withIndex("by_profile_cohort", (q) => q.eq("profileId", profileId).eq("cohortId", args.cohortId)).unique(),
      ctx.db.get(profileId),
    ]);
    if (!cohort || !target || (!member.isOrganizer && membership?.status !== "active") || (readOnly && !membership)) throw new ConvexError("An active membership in this cohort is required.");
    const [entries, mission, outcomes] = await Promise.all([
      entriesFor(ctx, args.cohortId, profileId),
      ctx.db.query("onboarding").withIndex("by_profile_cohort", (q) => q.eq("profileId", profileId).eq("cohortId", args.cohortId)).unique(),
      ctx.db.query("sprintOutcomes").withIndex("by_profile_cohort", (q) => q.eq("profileId", profileId).eq("cohortId", args.cohortId)).collect(),
    ]);
    return { cohortId: cohort._id, cohortName: cohort.name, startDate: membership?.startDateOverride ?? cohort.startDate, endDate: membership?.endDateOverride ?? cohort.endDate,
      entries, goals: mission?.confirmedGoals ?? [], missionConfirmedAt: mission?.confirmedAt, outcomes,
      canPlan: !readOnly && membership?.status === "active", readOnly, management: false, profileName: target.name };
  },
});

export const shared = query({
  args: { cohortId: v.id("cohorts") },
  handler: async (ctx, args): Promise<SprintData> => {
    const { profile } = await requireOrganizer(ctx);
    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) throw new ConvexError("This cohort is unavailable. Choose another cohort.");
    return { cohortId: cohort._id, cohortName: cohort.name, startDate: cohort.startDate, endDate: cohort.endDate,
      entries: await entriesFor(ctx, cohort._id, profile._id, true), goals: [], outcomes: [], canPlan: true, readOnly: false, management: true };
  },
});

export const saveActivity = mutation({
  args: { cohortId: v.id("cohorts"), scope: v.union(v.literal("personal"), v.literal("cohort")), activityId: v.optional(v.id("sprintActivities")), expectedRevision: v.number(), expectedProgressRevision: v.number(),
    input: v.object(activityFields), opportunityId: v.optional(v.id("opportunities")), goalLink: v.optional(goalLinkValidator), allowOverlap: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const member = args.scope === "cohort" ? await requireOrganizer(ctx) : await requireMember(ctx);
    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) throw new ConvexError("This cohort is unavailable. Choose another cohort.");
    const stay = args.scope === "personal" ? await ownStay(ctx, args.cohortId) : cohort;
    const parsed = activitySchema.safeParse(args.input);
    if (!parsed.success) throw new ConvexError(parsed.error.issues[0].message);
    const input = parsed.data;
    checkDates(input, stay.startDate, stay.endDate);
    const existing = args.activityId ? await ctx.db.get(args.activityId) : null;
    if (args.activityId && (!existing || existing.cohortId !== cohort._id || existing.scope !== args.scope || (existing.scope === "personal" && existing.ownerId !== member.profile._id))) throw new ConvexError("You can only edit activities in your own Sprint or manage shared cohort activities as an organizer.");
    if ((existing?.revision ?? 0) !== args.expectedRevision || existing?.cancelledAt) throw new ConvexError("This activity changed or was cancelled. Close the editor and reopen it.");
    if (args.scope === "cohort" && (args.goalLink || args.opportunityId)) throw new ConvexError("Shared activities do not have personal goals or opportunity links.");
    if (existing && args.opportunityId && args.opportunityId !== existing.opportunityId) throw new ConvexError("An activity’s original opportunity cannot be changed.");
    let source: Doc<"opportunities"> | null = null;
    if (!existing && args.opportunityId) {
      source = await ctx.db.get(args.opportunityId);
      if (!source || source.status !== "published") throw new ConvexError("This opportunity is no longer published. Refresh opportunities.");
      const duplicate = await ctx.db.query("sprintActivities").withIndex("by_owner_cohort_opportunity", (q) => q.eq("ownerId", member.profile._id).eq("cohortId", cohort._id).eq("opportunityId", source!._id)).first();
      if (duplicate) throw new ConvexError("This opportunity is already in your Sprint. Edit the existing activity instead.");
    }
    const entries = await entriesFor(ctx, cohort._id, member.profile._id, args.scope === "cohort");
    const conflicts = overlapping(input, entries, existing?._id);
    if (conflicts.length && !args.allowOverlap) throw new ConvexError(`This time overlaps ${conflicts.map((item) => item.title).join(", ")}. Review the time or choose to keep the overlap.`);
    const currentProgress = existing && args.scope === "personal" ? await participation(ctx, member.profile._id, existing._id) : null;
    if (args.scope === "personal") {
      await checkGoal(ctx, member.profile._id, cohort._id, args.goalLink);
      if ((currentProgress?.revision ?? 0) !== args.expectedProgressRevision) throw new ConvexError("Your completion or goal link changed. Close the editor and reopen it.");
    }
    const updatedAt = Date.now(), revision = (existing?.revision ?? 0) + 1;
    let activityId: Id<"sprintActivities">;
    if (existing) {
      await ctx.db.patch(existing._id, { ...input, day: input.day, startAt: input.startAt, endAt: input.endAt, updatedAt, revision });
      activityId = existing._id;
    } else activityId = await ctx.db.insert("sprintActivities", { ...input, cohortId: cohort._id, scope: args.scope, ownerId: args.scope === "personal" ? member.profile._id : undefined,
      createdBy: member.profile._id, revision, updatedAt, ...(source ? { opportunityId: source._id, sourceUrl: source.sourceUrl, sourceUpdatedAt: source.updatedAt } : {}) });
    if (args.scope === "personal") {
      const sameGoal = JSON.stringify(currentProgress?.goalLink) === JSON.stringify(args.goalLink);
      const progress = { ...progressView(currentProgress ?? undefined), profileId: member.profile._id, cohortId: cohort._id, activityId, goalLink: args.goalLink,
        contribution: sameGoal ? currentProgress?.contribution ?? 0 : 0, revision: (currentProgress?.revision ?? 0) + 1, updatedAt, activityRevision: revision };
      if (currentProgress) await ctx.db.patch(currentProgress._id, progress);
      else await ctx.db.insert("sprintProgress", progress);
    }
    return activityId;
  },
});

export const setProgress = mutation({
  args: { activityId: v.id("sprintActivities"), expectedActivityRevision: v.number(), expectedProgressRevision: v.number(), input: v.object(progressFields) },
  handler: async (ctx, args) => {
    const { activity, member } = await ownActivity(ctx, args.activityId);
    if (activity.cancelledAt || activity.revision !== args.expectedActivityRevision) throw new ConvexError("This activity changed or was cancelled. Reopen it before updating attendance or progress.");
    const result = progressSchema.safeParse(args.input);
    if (!result.success) throw new ConvexError(result.error.issues[0].message);
    await checkGoal(ctx, member.profile._id, activity.cohortId, result.data.goalLink);
    const current = await participation(ctx, member.profile._id, activity._id);
    if ((current?.revision ?? 0) !== args.expectedProgressRevision) throw new ConvexError("Your progress changed in another tab. Reopen this activity.");
    const updatedAt = Date.now();
    const patch = { ...result.data, goalLink: result.data.goalLink, activityRevision: activity.revision, revision: (current?.revision ?? 0) + 1, updatedAt,
      completedAt: result.data.status === "completed" ? current?.completedAt ?? updatedAt : undefined };
    if (current) await ctx.db.patch(current._id, patch);
    else await ctx.db.insert("sprintProgress", { ...patch, profileId: member.profile._id, cohortId: activity.cohortId, activityId: activity._id });
  },
});

export const removeActivity = mutation({
  args: { activityId: v.id("sprintActivities"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new ConvexError("This activity was already removed. Refresh your Sprint.");
    if (activity.scope === "cohort") await requireOrganizer(ctx);
    else await ownActivity(ctx, activity._id);
    if (activity.revision !== args.expectedRevision) throw new ConvexError("This activity changed. Reopen it before removing it.");
    if (activity.scope === "cohort") { await ctx.db.patch(activity._id, { cancelledAt: Date.now(), updatedAt: Date.now(), revision: activity.revision + 1 }); return; }
    const [progress, outcomes] = await Promise.all([
      ctx.db.query("sprintProgress").withIndex("by_activity", (q) => q.eq("activityId", activity._id)).collect(),
      ctx.db.query("sprintOutcomes").withIndex("by_activity", (q) => q.eq("activityId", activity._id)).collect(),
    ]);
    for (const item of progress) await ctx.db.delete(item._id);
    for (const item of outcomes) await ctx.db.patch(item._id, { activityId: undefined });
    await ctx.db.delete(activity._id);
  },
});

export const restoreActivity = mutation({
  args: { activityId: v.id("sprintActivities"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.scope !== "cohort" || activity.revision !== args.expectedRevision) throw new ConvexError("This shared activity changed. Reopen it before restoring it.");
    const cohort = await ctx.db.get(activity.cohortId);
    if (!cohort) throw new ConvexError("This cohort is unavailable.");
    checkDates(activity, cohort.startDate, cohort.endDate);
    await ctx.db.patch(activity._id, { cancelledAt: undefined, updatedAt: Date.now(), revision: activity.revision + 1 });
  },
});

export const saveOutcome = mutation({
  args: { cohortId: v.id("cohorts"), outcomeId: v.optional(v.id("sprintOutcomes")), expectedUpdatedAt: v.optional(v.number()), activityId: v.optional(v.id("sprintActivities")), input: v.object(outcomeFields) },
  handler: async (ctx, args) => {
    const { member } = await ownStay(ctx, args.cohortId);
    const result = outcomeSchema.safeParse(args.input);
    if (!result.success) throw new ConvexError(result.error.issues[0].message);
    const current = args.outcomeId ? await ctx.db.get(args.outcomeId) : null;
    if (args.outcomeId && (!current || current.profileId !== member.profile._id || current.cohortId !== args.cohortId)) throw new ConvexError("You can only edit your own outcomes in this cohort.");
    if (current && current.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("This outcome changed. Close the editor and reopen it.");
    if (args.activityId) {
      const { activity } = await ownActivity(ctx, args.activityId);
      if (activity.cohortId !== args.cohortId) throw new ConvexError("Choose an activity from this cohort.");
    }
    const patch = { ...result.data, activityId: args.activityId, updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1) };
    if (current) { await ctx.db.patch(current._id, patch); return current._id; }
    return ctx.db.insert("sprintOutcomes", { ...patch, profileId: member.profile._id, cohortId: args.cohortId });
  },
});

export const removeOutcome = mutation({
  args: { outcomeId: v.id("sprintOutcomes"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const outcome = await ctx.db.get(args.outcomeId);
    if (!outcome) throw new ConvexError("This outcome was already removed. Refresh your Sprint.");
    const { member } = await ownStay(ctx, outcome.cohortId);
    if (outcome.profileId !== member.profile._id) throw new ConvexError("You can only remove your own outcomes.");
    if (outcome.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("This outcome changed. Reopen it before removing it.");
    await ctx.db.delete(outcome._id);
  },
});
