import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./access";
import { answersSchema, draftAnswersSchema, templateGoals, validateGoals } from "../lib/mission";
import { answersValidator, fallbackValidator, goalValidator, sourceValidator } from "./missionValidators";

async function ownStay(ctx: QueryCtx | MutationCtx, cohortId: Id<"cohorts">) {
  const member = await requireMember(ctx);
  const membership = member.memberships.find((m) => m.cohortId === cohortId && m.status === "active");
  const cohort = await ctx.db.get(cohortId);
  if (!membership || !cohort) throw new ConvexError("An active membership in this cohort is required.");
  return { profileId: member.profile._id, startDate: membership.startDateOverride ?? cohort.startDate, endDate: membership.endDateOverride ?? cohort.endDate };
}

async function record(ctx: QueryCtx | MutationCtx, profileId: Id<"profiles">, cohortId: Id<"cohorts">) {
  return ctx.db.query("onboarding").withIndex("by_profile_cohort", (q) => q.eq("profileId", profileId).eq("cohortId", cohortId)).unique();
}

function goalsForStay(goals: unknown, startDate: string, endDate: string) {
  try { return validateGoals(goals, startDate, endDate); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Set every deadline")) throw new ConvexError(error.message);
    throw new ConvexError("Use exactly three goals, each with a title, a target from 1 to 100, a measure, a valid deadline, and one to three first actions.");
  }
}

function completeAnswers(doc: Doc<"onboarding"> | null) {
  const result = answersSchema.safeParse(doc?.answers);
  if (!doc || !result.success) throw new ConvexError("Complete all four onboarding steps before creating your mission.");
  return { doc, answers: result.data };
}

export const required = query({
  args: {},
  handler: async (ctx) => {
    const { profile, memberships, isOrganizer } = await requireMember(ctx);
    // Organizers need the Command Center to set up cohorts before participating.
    if (isOrganizer) return null;
    const pending = await Promise.all(memberships.filter((membership) => membership.status === "active").map(async (membership) => {
      const [cohort, onboarding] = await Promise.all([
        ctx.db.get(membership.cohortId), record(ctx, profile._id, membership.cohortId),
      ]);
      if (!cohort || cohort.status === "completed" || onboarding?.confirmedGoals?.length === 3) return null;
      return { cohortId: cohort._id, status: cohort.status, startDate: membership.startDateOverride ?? cohort.startDate };
    }));
    return pending.filter((cohort) => cohort !== null)
      .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || a.startDate.localeCompare(b.startDate))[0]?.cohortId ?? null;
  },
});

export const get = query({
  args: { cohortId: v.id("cohorts"), profileId: v.optional(v.id("profiles")) },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const profileId = args.profileId ?? member.profile._id;
    if (profileId !== member.profile._id && !member.isOrganizer) throw new ConvexError("You can only view your own mission.");
    if (profileId === member.profile._id) await ownStay(ctx, args.cohortId);
    else if (!await ctx.db.get(args.cohortId)) throw new ConvexError("Cohort not found.");
    return record(ctx, profileId, args.cohortId);
  },
});

export const saveDraft = mutation({
  args: { cohortId: v.id("cohorts"), answers: answersValidator, step: v.number() },
  handler: async (ctx, args) => {
    const { profileId } = await ownStay(ctx, args.cohortId);
    const parsed = draftAnswersSchema.safeParse(args.answers);
    if (!parsed.success || !Number.isInteger(args.step) || args.step < 0 || args.step > 4) throw new ConvexError("Keep answers under 1,200 characters and choose up to eight industries.");
    const current = await record(ctx, profileId, args.cohortId);
    const changed = !current || JSON.stringify(current.answers) !== JSON.stringify(parsed.data);
    const revision = (current?.revision ?? 0) + (changed ? 1 : 0);
    const patch = { answers: parsed.data, step: args.step, revision, updatedAt: Date.now(), ...(changed ? { generationId: undefined } : {}) };
    if (current) await ctx.db.patch(current._id, patch);
    else await ctx.db.insert("onboarding", { profileId, cohortId: args.cohortId, ...patch });
    return revision;
  },
});

export const saveProposal = mutation({
  args: { cohortId: v.id("cohorts"), goals: v.array(goalValidator), expectedRevision: v.number(), confirm: v.boolean() },
  handler: async (ctx, args) => {
    const stay = await ownStay(ctx, args.cohortId);
    const { doc } = completeAnswers(await record(ctx, stay.profileId, args.cohortId));
    if (doc.revision !== args.expectedRevision) throw new ConvexError("Your mission changed in another window. Reload before saving.");
    const goals = goalsForStay(args.goals, stay.startDate, stay.endDate);
    const revision = doc.revision + 1;
    await ctx.db.patch(doc._id, { proposal: goals, revision, step: 4, generationId: undefined, updatedAt: Date.now(),
      ...(args.confirm ? { confirmedGoals: goals, confirmedAt: Date.now() } : {}) });
    return revision;
  },
});

export const useTemplates = mutation({
  args: { cohortId: v.id("cohorts") },
  handler: async (ctx, args) => {
    const stay = await ownStay(ctx, args.cohortId);
    const { doc, answers } = completeAnswers(await record(ctx, stay.profileId, args.cohortId));
    const goals = templateGoals(answers, stay.startDate, stay.endDate);
    const revision = doc.revision + 1;
    await ctx.db.patch(doc._id, { proposal: goals, source: "template", fallbackReason: "requested", step: 4, revision, generationId: undefined, updatedAt: Date.now() });
    return { goals, revision, source: "template" as const, fallbackReason: "requested" as const };
  },
});

export const beginGeneration = internalMutation({
  args: { cohortId: v.id("cohorts"), generationId: v.string() },
  handler: async (ctx, args) => {
    const stay = await ownStay(ctx, args.cohortId);
    const { doc, answers } = completeAnswers(await record(ctx, stay.profileId, args.cohortId));
    const now = Date.now();
    const limit = await ctx.db.query("missionGenerationLimits").withIndex("by_profile", (q) => q.eq("profileId", stay.profileId)).unique();
    if (limit && now - limit.lastAttempt < 60_000) throw new ConvexError("Wait one minute before creating new goals.");
    const sameWindow = limit && now - limit.windowStart < 3_600_000;
    if (sameWindow && limit.count >= 5) throw new ConvexError("You’ve reached five generations this hour. Try again later.");
    const fields = { windowStart: sameWindow ? limit.windowStart : now, count: sameWindow ? limit.count + 1 : 1, lastAttempt: now };
    if (limit) await ctx.db.patch(limit._id, fields);
    else await ctx.db.insert("missionGenerationLimits", { profileId: stay.profileId, ...fields });
    await ctx.db.patch(doc._id, { generationId: args.generationId });
    return { ...stay, answers, revision: doc.revision };
  },
});

export const finishGeneration = internalMutation({
  args: { cohortId: v.id("cohorts"), generationId: v.string(), revision: v.number(), goals: v.array(goalValidator), source: sourceValidator, fallbackReason: v.optional(fallbackValidator) },
  handler: async (ctx, args) => {
    // Recheck access, dates and revision after the external request returns.
    const stay = await ownStay(ctx, args.cohortId);
    const doc = await record(ctx, stay.profileId, args.cohortId);
    if (!doc || doc.revision !== args.revision || doc.generationId !== args.generationId) throw new ConvexError("Your answers or goals changed during generation. Create new suggestions when you’re ready.");
    const goals = goalsForStay(args.goals, stay.startDate, stay.endDate);
    const revision = doc.revision + 1;
    await ctx.db.patch(doc._id, { proposal: goals, source: args.source, fallbackReason: args.fallbackReason, step: 4, revision, generationId: undefined, updatedAt: Date.now() });
    return { goals, revision, source: args.source, fallbackReason: args.fallbackReason };
  },
});
