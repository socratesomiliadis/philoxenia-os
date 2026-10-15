import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember, requireOrganizer } from "./access";
import { opportunityFields } from "./opportunityValidators";
import { categoriesFromGoals, opportunitySchema, type RecommendationContext } from "../lib/opportunities";
import { curatedOpportunities } from "../lib/curated-opportunities";

export const list = query({
  args: { cohortId: v.optional(v.id("cohorts")), management: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { profile, isOrganizer, memberships } = args.management ? await requireOrganizer(ctx) : await requireMember(ctx);
    const [entries, bookmarks] = await Promise.all([
      args.management ? ctx.db.query("opportunities").collect() : ctx.db.query("opportunities").withIndex("by_status", (q) => q.eq("status", "published")).collect(),
      ctx.db.query("bookmarks").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).collect(),
    ]);
    const saved = new Set(bookmarks.map((bookmark) => bookmark.opportunityId));
    const context: RecommendationContext = { interests: [], categories: [] };
    if (args.cohortId) {
      const membership = memberships.find((item) => item.cohortId === args.cohortId && item.status === "active");
      if (!membership && !isOrganizer) throw new ConvexError("Choose a cohort you belong to.");
      const cohort = await ctx.db.get(args.cohortId);
      if (!cohort) throw new ConvexError("This cohort is unavailable. Refresh and choose another cohort.");
      context.startDate = membership?.startDateOverride ?? cohort.startDate;
      context.endDate = membership?.endDateOverride ?? cohort.endDate;
      // Personalization always reads the caller's own answers and confirmed goals.
      const onboarding = membership ? await ctx.db.query("onboarding").withIndex("by_profile_cohort", (q) => q.eq("profileId", profile._id).eq("cohortId", args.cohortId!)).unique() : null;
      context.interests = onboarding?.answers.industries ?? [];
      context.categories = categoriesFromGoals(onboarding?.confirmedGoals ?? []);
    }
    return {
      entries: entries.map((entry) => {
        const { createdBy, ...listing } = entry;
        return { ...listing, ...(args.management ? { createdBy } : {}), saved: saved.has(entry._id), ...(entry.lastImportedAt ? { sourceStale: Date.now() - entry.lastImportedAt > 8 * 86_400_000 } : {}) };
      }),
      context,
    };
  },
});

export const save = mutation({
  args: {
    opportunityId: v.optional(v.id("opportunities")), expectedUpdatedAt: v.optional(v.number()),
    opportunity: v.object(opportunityFields), confirmSupport: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOrganizer(ctx);
    const result = opportunitySchema.safeParse(args.opportunity);
    if (!result.success) throw new ConvexError(result.error.issues[0]?.message ?? "Review the opportunity fields and try again.");
    const input = result.data;
    if (input.kind === "alumni" && input.status === "published" && !args.confirmSupport) {
      throw new ConvexError("Confirm the alumnus agreed to this support path before publishing.");
    }
    const existing = args.opportunityId ? await ctx.db.get(args.opportunityId) : null;
    if (args.opportunityId && !existing) throw new ConvexError("This listing is unavailable. Refresh the catalog.");
    if (existing && existing.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("Another organizer changed this listing. Close the editor and reopen it to load their changes.");
    if (existing?.primarySourceId && input.kind !== existing.kind) throw new ConvexError("Imported listings must keep their original type. Create a separate listing for another type.");
    const duplicate = await ctx.db.query("opportunities").withIndex("by_kind_source", (q) => q.eq("kind", input.kind).eq("sourceUrl", input.sourceUrl)).first();
    if (duplicate && duplicate._id !== args.opportunityId) throw new ConvexError("This source is already listed for this type. Edit the existing listing instead.");
    const updatedAt = Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1);
    const supportConfirmedAt = input.kind === "alumni" && args.confirmSupport ? updatedAt : undefined;
    if (existing) {
      const changedFields = Object.keys(opportunityFields).filter((key) => JSON.stringify(input[key as keyof typeof input]) !== JSON.stringify(existing[key as keyof typeof input]));
      const timingFields = ["startAt", "endAt", "eventDate", "eventEndDate"];
      const importOverrides = existing.primarySourceId ? [...new Set([...(existing.importOverrides ?? []), ...changedFields, ...(timingFields.some((key) => changedFields.includes(key)) ? timingFields : [])])] : undefined;
      // Explicit undefined values clear old event/offer fields when changing type.
      await ctx.db.patch(existing._id, { ...input, startAt: input.startAt, endAt: input.endAt, eventDate: input.eventDate, eventEndDate: input.eventEndDate, cost: input.cost, costNote: input.costNote, support: input.support, supportConfirmedAt, updatedAt, importOverrides });
      return existing._id;
    }
    return ctx.db.insert("opportunities", { ...input, createdBy: profile._id, updatedAt, supportConfirmedAt });
  },
});

export const setBookmark = mutation({
  args: { opportunityId: v.id("opportunities"), saved: v.boolean() },
  handler: async (ctx, args) => {
    const { profile } = await requireMember(ctx);
    const entry = await ctx.db.get(args.opportunityId);
    if (!entry || entry.status !== "published") throw new ConvexError("This opportunity is no longer published. Refresh the catalog.");
    const bookmark = await ctx.db.query("bookmarks").withIndex("by_profile_opportunity", (q) => q.eq("profileId", profile._id).eq("opportunityId", args.opportunityId)).unique();
    if (args.saved && !bookmark) await ctx.db.insert("bookmarks", { profileId: profile._id, opportunityId: entry._id });
    if (!args.saved && bookmark) await ctx.db.delete(bookmark._id);
    return args.saved;
  },
});

export const addCuratedStarters = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireOrganizer(ctx);
    let added = 0;
    for (const entry of curatedOpportunities) {
      const input = opportunitySchema.parse(entry);
      const existing = await ctx.db.query("opportunities").withIndex("by_kind_source", (q) => q.eq("kind", input.kind).eq("sourceUrl", input.sourceUrl)).first();
      if (existing) continue;
      await ctx.db.insert("opportunities", { ...input, createdBy: profile._id, updatedAt: Date.now() });
      added++;
    }
    return { added };
  },
});
