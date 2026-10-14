import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { FunctionArgs } from "convex/server";
import { components } from "./_generated/api";
import { authComponent } from "./auth";
import { isOrganizerEmail, requireMember, requireOrganizer } from "./access";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const profile = await ctx.db.query("profiles").withIndex("by_auth_user", (q) => q.eq("authUserId", user._id)).unique();
    const memberships = profile ? await ctx.db.query("memberships").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).collect() : [];
    const invitations = await ctx.db.query("invitations").withIndex("by_email", (q) => q.eq("email", user.email.toLowerCase())).collect();
    const isOrganizer = isOrganizerEmail(user.email);
    const allowed = user.emailVerified && !profile?.suspended && (isOrganizer || profile?.isAlumni ||
      memberships.some((m) => m.status === "active") || invitations.some((i) => i.status === "pending"));
    return { name: user.name, email: user.email, image: user.image, profile, isOrganizer, participantCohortIds: memberships.filter((m) => m.status === "active").map((m) => m.cohortId), allowed: Boolean(allowed), needsProvisioning: !profile || invitations.some((i) => i.status === "pending") };
  },
});

export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user.emailVerified) throw new ConvexError("Use a verified Google account.");
    const email = user.email.trim().toLowerCase();
    const invitations = await ctx.db.query("invitations").withIndex("by_email", (q) => q.eq("email", email)).collect();
    const pending = invitations.filter((i) => i.status === "pending");
    let profile = await ctx.db.query("profiles").withIndex("by_auth_user", (q) => q.eq("authUserId", user._id)).unique();
    if (profile?.suspended) throw new ConvexError("Your access has been suspended. Contact an organizer.");
    if (!isOrganizerEmail(email) && pending.length === 0) {
      await requireMember(ctx);
    }
    const profileId = profile?._id ?? await ctx.db.insert("profiles", {
      authUserId: user._id, email, name: user.name, image: user.image ?? undefined,
      isAlumni: false, suspended: false,
    });
    if (profile) await ctx.db.patch(profileId, { name: user.name, image: user.image ?? undefined });
    for (const invitation of pending) {
      const membership = await ctx.db.query("memberships").withIndex("by_profile_cohort", (q) => q.eq("profileId", profileId).eq("cohortId", invitation.cohortId)).unique();
      if (membership) await ctx.db.patch(membership._id, { status: "active" });
      else await ctx.db.insert("memberships", { profileId, cohortId: invitation.cohortId, status: "active" });
      await ctx.db.patch(invitation._id, { status: "accepted", acceptedBy: profileId });
    }
    profile = await ctx.db.get(profileId);
    return profile;
  },
});

export const community = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const profiles = await ctx.db.query("profiles").collect();
    const activeMemberships = (await ctx.db.query("memberships").collect()).filter((m) => m.status === "active");
    return profiles.filter((p) => !p.suspended && (p.isAlumni || isOrganizerEmail(p.email) || activeMemberships.some((m) => m.profileId === p._id)))
      .map((p) => ({ _id: p._id, name: p.name, image: p.image, isAlumni: p.isAlumni, isOrganizer: isOrganizerEmail(p.email) }));
  },
});

export const setSuspended = mutation({
  args: { profileId: v.id("profiles"), suspended: v.boolean() },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new ConvexError("Participant not found.");
    if (isOrganizerEmail(profile.email)) throw new ConvexError("Manage organizer access through backend configuration.");
    await ctx.db.patch(profile._id, { suspended: args.suspended });
  },
});

async function deleteAuthRows(ctx: MutationCtx, input: FunctionArgs<typeof components.betterAuth.adapter.deleteMany>["input"]) {
  let cursor: string | null = null;
  do {
    const result: { isDone: boolean; continueCursor: string } = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input, paginationOpts: { cursor, numItems: 100 },
    });
    if (result.isDone) return;
    cursor = result.continueCursor;
  } while (cursor !== null);
}

export const deleteUser = mutation({
  args: { profileId: v.id("profiles"), confirmationEmail: v.string() },
  handler: async (ctx, args) => {
    const { profile: organizer } = await requireOrganizer(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new ConvexError("This user has already been deleted. Refresh the roster.");
    const authUser = await authComponent.getAnyUserById(ctx, profile.authUserId);
    if (profile._id === organizer._id || isOrganizerEmail(profile.email) || (authUser && isOrganizerEmail(authUser.email))) {
      throw new ConvexError("Organizer accounts cannot be deleted. Manage organizer access through backend configuration.");
    }
    if (args.confirmationEmail.trim().toLowerCase() !== profile.email.toLowerCase()) {
      throw new ConvexError("Type this user’s email address to confirm deletion.");
    }
    const [memberships, onboarding, limits, invitations, acceptedInvitations, authEmailInvitations, bookmarks, sprintActivities, sprintProgress, sprintOutcomes] = await Promise.all([
      ctx.db.query("memberships").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).collect(),
      ctx.db.query("onboarding").withIndex("by_profile_cohort", (q) => q.eq("profileId", profile._id)).collect(),
      ctx.db.query("missionGenerationLimits").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).collect(),
      ctx.db.query("invitations").withIndex("by_email", (q) => q.eq("email", profile.email.toLowerCase())).collect(),
      ctx.db.query("invitations").withIndex("by_accepted_profile", (q) => q.eq("acceptedBy", profile._id)).collect(),
      authUser && authUser.email.toLowerCase() !== profile.email.toLowerCase()
        ? ctx.db.query("invitations").withIndex("by_email", (q) => q.eq("email", authUser.email.toLowerCase())).collect()
        : [],
      ctx.db.query("bookmarks").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).collect(),
      ctx.db.query("sprintActivities").withIndex("by_owner_cohort", (q) => q.eq("ownerId", profile._id)).collect(),
      ctx.db.query("sprintProgress").withIndex("by_profile_cohort", (q) => q.eq("profileId", profile._id)).collect(),
      ctx.db.query("sprintOutcomes").withIndex("by_profile_cohort", (q) => q.eq("profileId", profile._id)).collect(),
    ]);
    // These component mutations participate in the same transaction. A failed
    // cleanup rolls back the deletion rather than leaving a partially reset user.
    for (const model of ["session", "account", "twoFactor", "oauthApplication", "oauthAccessToken", "oauthConsent"] as const) {
      await deleteAuthRows(ctx, { model, where: [{ field: "userId", operator: "eq", value: profile.authUserId }] });
    }
    for (const identifier of new Set([profile.email.toLowerCase(), profile.authUserId, ...(authUser ? [authUser.email.toLowerCase()] : [])])) {
      await deleteAuthRows(ctx, { model: "verification", where: [{ field: "identifier", operator: "eq", value: identifier }] });
    }
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "user", where: [{ field: "_id", operator: "eq", value: profile.authUserId }] } });
    const related = new Map([...memberships, ...onboarding, ...limits, ...invitations, ...acceptedInvitations, ...authEmailInvitations, ...bookmarks, ...sprintActivities, ...sprintProgress, ...sprintOutcomes].map((doc) => [doc._id, doc]));
    for (const id of related.keys()) await ctx.db.delete(id);
    await ctx.db.delete(profile._id);
    return { email: profile.email };
  },
});
