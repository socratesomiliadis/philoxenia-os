import { ConvexError } from "convex/values";
import { authComponent } from "./auth";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export function isOrganizerEmail(email: string) {
  // No organizer access is granted unless explicitly configured on the backend.
  return (process.env.ORGANIZER_EMAILS ?? "").split(",")
    .map((value) => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

export async function requireMember(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user?.emailVerified) throw new ConvexError("Sign in with your verified Google account.");
  const profile = await ctx.db.query("profiles").withIndex("by_auth_user", (q) => q.eq("authUserId", user._id)).unique();
  if (!profile || profile.suspended) throw new ConvexError("Your account does not have access.");
  const isOrganizer = isOrganizerEmail(user.email);
  const memberships = await ctx.db.query("memberships").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).collect();
  if (!isOrganizer && !profile.isAlumni && !memberships.some((membership) => membership.status === "active")) {
    throw new ConvexError("An active Philoxenia invitation is required.");
  }
  return { profile, isOrganizer, memberships };
}

export async function requireOrganizer(ctx: QueryCtx | MutationCtx) {
  const member = await requireMember(ctx);
  if (!member.isOrganizer) throw new ConvexError("Only organizers can do this.");
  return member;
}
