import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
