import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireMember, requireOrganizer } from "./access";

export async function queueEmail(ctx: MutationCtx, input: { email: string; message: string; path: string; profileId?: Id<"profiles">; invitationId?: Id<"invitations">; requestId?: Id<"supportRequests"> }) {
  const id = await ctx.db.insert("emailDeliveries", { ...input, status: "pending", attempts: 0, updatedAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, { deliveryId: id });
}
export async function notify(ctx: MutationCtx, profileId: Id<"profiles">, message: string, requestId?: Id<"supportRequests">) {
  const profile = await ctx.db.get(profileId);
  if (!profile || profile.suspended) return;
  await ctx.db.insert("notifications", { profileId, message, requestId, createdAt: Date.now() });
  await queueEmail(ctx, { profileId, email: profile.email, message, requestId, path: "/open-doors" });
}
export const inbox = query({ args: {}, handler: async (ctx) => {
  const { profile } = await requireMember(ctx);
  return ctx.db.query("notifications").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).order("desc").take(50);
} });
export const read = mutation({ args: { notificationId: v.id("notifications") }, handler: async (ctx, { notificationId }) => {
  const { profile } = await requireMember(ctx), notification = await ctx.db.get(notificationId);
  if (!notification || notification.profileId !== profile._id) throw new ConvexError("This notification is unavailable.");
  await ctx.db.patch(notificationId, { readAt: Date.now() });
} });
export const deliveries = query({ args: {}, handler: async (ctx) => {
  await requireOrganizer(ctx);
  // Pilot-sized outbox; no credentials or recipient email addresses leave this query.
  return (await ctx.db.query("emailDeliveries").order("desc").take(50)).map(({ _id, message, status, attempts, error, updatedAt }) => ({ _id, message, status, attempts, error, updatedAt }));
} });
export const retry = mutation({ args: { deliveryId: v.id("emailDeliveries") }, handler: async (ctx, { deliveryId }) => {
  await requireOrganizer(ctx);
  const delivery = await ctx.db.get(deliveryId);
  if (!delivery || !["failed", "disabled"].includes(delivery.status)) throw new ConvexError("Only failed or disabled deliveries can be retried.");
  // Resend retains idempotency keys for 24 hours. Avoid uncertain duplicate sends beyond that window.
  if (Date.now() - delivery._creationTime > 23 * 3_600_000 || delivery.attempts >= 5) throw new ConvexError("The retry window or attempt limit has ended. Share the app link directly.");
  await ctx.db.patch(deliveryId, { status: "pending", error: undefined, updatedAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, { deliveryId });
} });
export const delivery = internalQuery({ args: { deliveryId: v.id("emailDeliveries") }, handler: async (ctx, { deliveryId }) => {
  const item = await ctx.db.get(deliveryId);
  if (!item || item.status !== "pending") return null;
  if (item.profileId) {
    const profile = await ctx.db.get(item.profileId);
    if (!profile || profile.suspended) return null;
  }
  if (item.invitationId && (await ctx.db.get(item.invitationId))?.status !== "pending") return null;
  return item;
} });
export const deliveryResult = internalMutation({ args: { deliveryId: v.id("emailDeliveries"), status: v.union(v.literal("sent"), v.literal("failed"), v.literal("disabled")), error: v.optional(v.string()), providerId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const item = await ctx.db.get(args.deliveryId);
  if (item && item.status === "pending") await ctx.db.patch(item._id, { status: args.status, error: args.error, providerId: args.providerId, attempts: item.attempts + 1, updatedAt: Date.now() });
} });
export const deliver = internalAction({ args: { deliveryId: v.id("emailDeliveries") }, handler: async (ctx, { deliveryId }): Promise<void> => {
  const item = await ctx.runQuery(internal.notifications.delivery, { deliveryId });
  if (!item) {
    await ctx.runMutation(internal.notifications.deliveryResult, { deliveryId, status: "disabled", error: "The recipient’s access or invitation is no longer available." }); return;
  }
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM, site = process.env.SITE_URL;
  if (!key || !from || !site) {
    await ctx.runMutation(internal.notifications.deliveryResult, { deliveryId, status: "disabled", error: "Configure RESEND_API_KEY, EMAIL_FROM, and SITE_URL on the Convex backend." }); return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `philoxenia-${deliveryId}` },
      body: JSON.stringify({ from, to: [item.email], subject: "Philoxenia OS · An update for you", text: `${item.message}\n\nOpen Philoxenia OS: ${new URL(item.path, site).href}\n\nSign in with your invited Google account.` }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}.`);
    const result = await response.json() as { id?: string };
    await ctx.runMutation(internal.notifications.deliveryResult, { deliveryId, status: "sent", providerId: result.id });
  } catch {
    await ctx.runMutation(internal.notifications.deliveryResult, { deliveryId, status: "failed", error: "Email could not be sent. The underlying action is saved; organizers can retry delivery." });
  }
} });
