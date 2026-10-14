import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isOrganizerEmail, requireMember, requireOrganizer } from "./access";
import { sprintDates, SF_TIMEZONE } from "../lib/cohort-dates";

const status = v.union(v.literal("upcoming"), v.literal("active"), v.literal("completed"));

function fields(name: string, description: string, startDate: string) {
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) throw new ConvexError("Use a cohort name between 2 and 80 characters.");
  if (description.length > 1000) throw new ConvexError("Keep the description under 1,000 characters.");
  try { return { name: trimmedName, description: description.trim(), ...sprintDates(startDate) }; }
  catch { throw new ConvexError("Choose a valid arrival date."); }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { isOrganizer, memberships } = await requireMember(ctx);
    if (isOrganizer) return (await ctx.db.query("cohorts").collect()).sort((a, b) => b.startDate.localeCompare(a.startDate));
    return (await Promise.all(memberships.filter((m) => m.status === "active").map(async (m) => {
      const cohort = await ctx.db.get(m.cohortId);
      return cohort ? { ...cohort, startDate: m.startDateOverride ?? cohort.startDate, endDate: m.endDateOverride ?? cohort.endDate } : null;
    }))).filter((c) => c !== null).sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.string(), startDate: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireOrganizer(ctx);
    return ctx.db.insert("cohorts", { ...fields(args.name, args.description, args.startDate), timezone: SF_TIMEZONE, status: "upcoming", createdBy: profile._id });
  },
});

export const update = mutation({
  args: { cohortId: v.id("cohorts"), name: v.string(), description: v.string(), startDate: v.string(), status },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    if (!await ctx.db.get(args.cohortId)) throw new ConvexError("Cohort not found.");
    await ctx.db.patch(args.cohortId, { ...fields(args.name, args.description, args.startDate), status: args.status });
  },
});

export const roster = query({
  args: { cohortId: v.id("cohorts") },
  handler: async (ctx, { cohortId }) => {
    await requireOrganizer(ctx);
    const memberships = await ctx.db.query("memberships").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
    const participants = await Promise.all(memberships.map(async (m) => ({ ...m, profile: await ctx.db.get(m.profileId) })));
    const invitations = await ctx.db.query("invitations").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
    return { participants, invitations: invitations.filter((i) => i.status !== "accepted") };
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireOrganizer(ctx);
    const [cohorts, memberships, invitations] = await Promise.all([
      ctx.db.query("cohorts").collect(), ctx.db.query("memberships").collect(), ctx.db.query("invitations").collect(),
    ]);
    return { cohorts: cohorts.length, participants: new Set(memberships.filter((m) => m.status === "active").map((m) => m.profileId)).size, pendingInvitations: invitations.filter((i) => i.status === "pending").length };
  },
});

export const updateMembership = mutation({
  args: { membershipId: v.id("memberships"), status: v.union(v.literal("active"), v.literal("revoked")), startDateOverride: v.optional(v.string()), suspended: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new ConvexError("Membership not found.");
    let dates: ReturnType<typeof sprintDates> | undefined;
    try { dates = args.startDateOverride ? sprintDates(args.startDateOverride) : undefined; }
    catch { throw new ConvexError("Choose a valid arrival date."); }
    const profile = await ctx.db.get(membership.profileId);
    if (args.suspended !== undefined && profile && args.suspended !== profile.suspended) {
      if (isOrganizerEmail(profile.email)) throw new ConvexError("Manage organizer access through backend configuration.");
      await ctx.db.patch(profile._id, { suspended: args.suspended });
    }
    await ctx.db.patch(membership._id, { status: args.status, startDateOverride: dates?.startDate, endDateOverride: dates?.endDate });
  },
});
