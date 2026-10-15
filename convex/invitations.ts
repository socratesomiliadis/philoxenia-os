import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOrganizer } from "./access";
import { queueEmail } from "./notifications";

export const invite = mutation({
  args: { cohortId: v.id("cohorts"), email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireOrganizer(ctx);
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ConvexError("Enter a valid email address.");
    if (args.name.trim().length > 100) throw new ConvexError("Keep names under 100 characters.");
    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort || cohort.status === "completed") throw new ConvexError("Choose an upcoming or active cohort.");
    const existing = await ctx.db.query("invitations").withIndex("by_email_cohort", (q) => q.eq("email", email).eq("cohortId", args.cohortId)).unique();
    if (existing && existing.status !== "revoked") throw new ConvexError("This email has already been invited to this cohort.");
    const data = { email, name: args.name.trim(), cohortId: args.cohortId, status: "pending" as const, invitedBy: profile._id };
    const invitationId = existing?._id ?? await ctx.db.insert("invitations", data);
    if (existing) await ctx.db.patch(existing._id, { ...data, acceptedBy: undefined });
    await queueEmail(ctx, { email, invitationId, message: `You’re invited to ${cohort.name} in Philoxenia OS. Sign in with this email address using Google or email and password to join.`, path: "/sign-in" });
    return invitationId;
  },
});

export const revoke = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, { invitationId }) => {
    await requireOrganizer(ctx);
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new ConvexError("Invitation not found.");
    if (invitation.status === "accepted") throw new ConvexError("Remove the participant's cohort access instead.");
    await ctx.db.patch(invitationId, { status: "revoked" });
  },
});
