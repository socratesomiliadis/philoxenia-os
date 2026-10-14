import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember, requireOrganizer } from "./access";
import { notify } from "./notifications";
import { offerFields } from "./openDoorsValidators";
import { offerSchema, requestSchema, reservesCapacity } from "../lib/open-doors";
import { activitySchema, assertInStay } from "../lib/sprint";
import { activityFields } from "./sprintValidators";

type Ctx = QueryCtx | MutationCtx;
async function requestAccess(ctx: Ctx, requestId: Id<"supportRequests">) {
  const member = await requireMember(ctx), request = await ctx.db.get(requestId);
  if (!request || (!member.isOrganizer && request.requesterId !== member.profile._id && request.alumnusId !== member.profile._id)) throw new ConvexError("This request is unavailable.");
  return { member, request };
}
function revision(request: Doc<"supportRequests">, expected: number) {
  if (request.revision !== expected) throw new ConvexError("This request changed. Reopen it before responding.");
}
async function available(ctx: Ctx, request: Doc<"supportRequests">) {
  const [offer, alumnus, requester, membership] = await Promise.all([
    ctx.db.get(request.offerId), ctx.db.get(request.alumnusId), ctx.db.get(request.requesterId),
    ctx.db.query("memberships").withIndex("by_profile_cohort", (q) => q.eq("profileId", request.requesterId).eq("cohortId", request.cohortId)).unique(),
  ]);
  if (!offer?.published || !alumnus?.isAlumni || alumnus.suspended || !requester || requester.suspended || membership?.status !== "active") throw new ConvexError("The offer or participant’s access is no longer available.");
  const requests = await ctx.db.query("supportRequests").withIndex("by_offer", (q) => q.eq("offerId", offer._id)).collect();
  if (!reservesCapacity(request.status) && requests.filter((item) => reservesCapacity(item.status)).length >= offer.capacity) throw new ConvexError("This offer is at capacity. Decline or wait until a place is released.");
  return offer;
}
export const catalog = query({ args: {}, handler: async (ctx) => {
  const { profile } = await requireMember(ctx);
  const offers = await ctx.db.query("alumniOffers").withIndex("by_published", (q) => q.eq("published", true)).collect();
  const result = await Promise.all(offers.map(async (offer) => {
    const owner = await ctx.db.get(offer.ownerId);
    if (!owner?.isAlumni || owner.suspended) return null;
    const requests = await ctx.db.query("supportRequests").withIndex("by_offer", (q) => q.eq("offerId", offer._id)).collect();
    return { ...offer, ownerName: owner.name, remaining: Math.max(0, offer.capacity - requests.filter((item) => reservesCapacity(item.status)).length), own: owner._id === profile._id };
  }));
  return result.filter((item) => item !== null);
} });
export const ownOffers = query({ args: {}, handler: async (ctx) => {
  const { profile } = await requireMember(ctx);
  return ctx.db.query("alumniOffers").withIndex("by_owner", (q) => q.eq("ownerId", profile._id)).collect();
} });
export const saveOffer = mutation({ args: { offerId: v.optional(v.id("alumniOffers")), expectedRevision: v.number(), input: v.object(offerFields) }, handler: async (ctx, args) => {
  const { profile } = await requireMember(ctx);
  if (!profile.isAlumni) throw new ConvexError("Only alumni can publish support offers.");
  const parsed = offerSchema.safeParse(args.input);
  if (!parsed.success) throw new ConvexError(parsed.error.issues[0].message);
  const current = args.offerId ? await ctx.db.get(args.offerId) : null;
  if (args.offerId && (!current || current.ownerId !== profile._id)) throw new ConvexError("You can only edit your own offers.");
  if ((current?.revision ?? 0) !== args.expectedRevision) throw new ConvexError("This offer changed. Reopen the editor.");
  if (current) {
    const requests = await ctx.db.query("supportRequests").withIndex("by_offer", (q) => q.eq("offerId", current._id)).collect();
    if (requests.filter((item) => reservesCapacity(item.status)).length > parsed.data.capacity) throw new ConvexError("Capacity cannot be lower than reserved places.");
    await ctx.db.patch(current._id, { ...parsed.data, revision: current.revision + 1, updatedAt: Date.now() }); return current._id;
  }
  return ctx.db.insert("alumniOffers", { ...parsed.data, ownerId: profile._id, revision: 1, updatedAt: Date.now() });
} });
export const graduate = mutation({ args: { profileId: v.id("profiles"), cohortId: v.id("cohorts") }, handler: async (ctx, args) => {
  const { profile: organizer } = await requireOrganizer(ctx);
  const [profile, cohort, membership] = await Promise.all([ctx.db.get(args.profileId), ctx.db.get(args.cohortId), ctx.db.query("memberships").withIndex("by_profile_cohort", (q) => q.eq("profileId", args.profileId).eq("cohortId", args.cohortId)).unique()]);
  if (!profile || profile.suspended || !membership || membership.status !== "active" || cohort?.status !== "completed") throw new ConvexError("Graduate an active participant from a completed cohort.");
  if (profile.isAlumni) return;
  await ctx.db.patch(profile._id, { isAlumni: true, graduatedAt: Date.now(), graduatedBy: organizer._id });
  await notify(ctx, profile._id, "You’re now a Philoxenia alumnus. Share support with the next cohort.");
} });
export const requests = query({ args: { organizer: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const member = args.organizer ? await requireOrganizer(ctx) : await requireMember(ctx);
  const rows = args.organizer ? await ctx.db.query("supportRequests").collect() : [...await ctx.db.query("supportRequests").withIndex("by_requester", (q) => q.eq("requesterId", member.profile._id)).collect(), ...await ctx.db.query("supportRequests").withIndex("by_alumnus", (q) => q.eq("alumnusId", member.profile._id)).collect()];
  return Promise.all(rows.sort((a, b) => b.updatedAt - a.updatedAt).map(async (request) => {
    const [requester, alumnus, activity, outcomes, coordination] = await Promise.all([
      ctx.db.get(request.requesterId), ctx.db.get(request.alumnusId), request.activityId ? ctx.db.get(request.activityId) : null,
      request.activityId ? ctx.db.query("sprintOutcomes").withIndex("by_activity", (q) => q.eq("activityId", request.activityId!)).collect() : [],
      args.organizer ? ctx.db.query("supportCoordination").withIndex("by_request", (q) => q.eq("requestId", request._id)).unique() : null,
    ]);
    return { ...request, requesterName: requester?.name ?? "Removed member", alumnusName: alumnus?.name ?? "Removed alumnus", isRequester: request.requesterId === member.profile._id, isRecipient: request.alumnusId === member.profile._id,
      meeting: activity ? { title: activity.title, startAt: activity.startAt, endAt: activity.endAt } : null, outcomeCount: outcomes.reduce((sum, outcome) => sum + outcome.quantity, 0), coordination };
  }));
} });
export const submitRequest = mutation({ args: { offerId: v.id("alumniOffers"), cohortId: v.id("cohorts"), goal: v.string(), fit: v.string() }, handler: async (ctx, args) => {
  const { profile, memberships } = await requireMember(ctx), offer = await ctx.db.get(args.offerId);
  if (!memberships.some((item) => item.cohortId === args.cohortId && item.status === "active")) throw new ConvexError("Choose a cohort you belong to.");
  if (!offer?.published || offer.ownerId === profile._id) throw new ConvexError("Choose a published offer from another alumnus.");
  const alumnus = await ctx.db.get(offer.ownerId);
  if (!alumnus?.isAlumni || alumnus.suspended) throw new ConvexError("This alumnus is unavailable.");
  const parsed = requestSchema.safeParse(args);
  if (!parsed.success) throw new ConvexError(parsed.error.issues[0].message);
  const existing = await ctx.db.query("supportRequests").withIndex("by_requester_offer", (q) => q.eq("requesterId", profile._id).eq("offerId", offer._id)).collect();
  if (existing.some((item) => ["pending", "alternative", "agreed"].includes(item.status))) throw new ConvexError("You already have an open request for this offer.");
  const all = await ctx.db.query("supportRequests").withIndex("by_offer", (q) => q.eq("offerId", offer._id)).collect();
  if (all.filter((item) => reservesCapacity(item.status)).length >= offer.capacity) throw new ConvexError("This offer is at capacity. Check back for availability.");
  const { kind, title, description, availability, capacity, connection, published } = offer;
  const id = await ctx.db.insert("supportRequests", { ...parsed.data, offerId: offer._id, cohortId: args.cohortId, requesterId: profile._id, alumnusId: offer.ownerId, offerSnapshot: { kind, title, description, availability, capacity, connection, published }, status: "pending", revision: 1, updatedAt: Date.now() });
  await notify(ctx, offer.ownerId, "A Hustler requested your support. Open the request to review their goal and fit.", id);
  return id;
} });
export const respond = mutation({ args: { requestId: v.id("supportRequests"), expectedRevision: v.number(), decision: v.union(v.literal("approve"), v.literal("decline"), v.literal("alternative")), response: v.string() }, handler: async (ctx, args) => {
  const { member, request } = await requestAccess(ctx, args.requestId); revision(request, args.expectedRevision);
  if (request.alumnusId !== member.profile._id || !member.profile.isAlumni) throw new ConvexError("Only the receiving alumnus can decide this request.");
  if (request.status !== "pending") throw new ConvexError("This request has already been answered.");
  const response = args.response.trim();
  if (response.length > 2000 || (args.decision !== "approve" && response.length < 10)) throw new ConvexError("Explain a decline or alternative in 10–2000 characters.");
  if (args.decision !== "decline") await available(ctx, request);
  const status = args.decision === "approve" ? "agreed" : args.decision === "alternative" ? "alternative" : "declined";
  await ctx.db.patch(request._id, { status, response, alternative: args.decision === "alternative" ? response : undefined, revision: request.revision + 1, updatedAt: Date.now() });
  await notify(ctx, request.requesterId, status === "alternative" ? "An alumnus proposed alternative support. Review and accept it before making plans." : status === "agreed" ? "Your support request was approved. Agree a time before adding a meeting to your Sprint." : "An alumnus declined your support request. Open it to read their response.", request._id);
} });
export const participantDecision = mutation({ args: { requestId: v.id("supportRequests"), expectedRevision: v.number(), accept: v.boolean() }, handler: async (ctx, args) => {
  const { member, request } = await requestAccess(ctx, args.requestId); revision(request, args.expectedRevision);
  if (member.profile._id !== request.requesterId) throw new ConvexError("Only the requester can accept or withdraw.");
  if (args.accept && request.status !== "alternative") throw new ConvexError("Only a proposed alternative can be accepted.");
  if (!args.accept && !["pending", "alternative", "agreed"].includes(request.status)) throw new ConvexError("This request is already closed.");
  if (args.accept) await available(ctx, request);
  if (!args.accept && request.activityId && await ctx.db.get(request.activityId)) throw new ConvexError("Remove the linked meeting from your Sprint before withdrawing support.");
  await ctx.db.patch(request._id, { status: args.accept ? "agreed" : "withdrawn", revision: request.revision + 1, updatedAt: Date.now() });
  await notify(ctx, request.alumnusId, args.accept ? "The Hustler accepted your alternative. You can now agree the meeting details." : "The Hustler withdrew their support request. Its place has been released.", request._id);
} });
export const complete = mutation({ args: { requestId: v.id("supportRequests"), expectedRevision: v.number(), response: v.string() }, handler: async (ctx, args) => {
  const { member, request } = await requestAccess(ctx, args.requestId); revision(request, args.expectedRevision);
  if (request.status !== "agreed" || ![request.requesterId, request.alumnusId].includes(member.profile._id)) throw new ConvexError("Only the requester or alumnus can report agreed support as completed.");
  if (args.response.trim().length < 10 || args.response.length > 2000) throw new ConvexError("Describe what happened in 10–2000 characters.");
  await ctx.db.patch(request._id, { status: "completed", response: args.response.trim(), completedBy: member.profile._id, revision: request.revision + 1, updatedAt: Date.now() });
  await notify(ctx, member.profile._id === request.requesterId ? request.alumnusId : request.requesterId, "Support was reported as completed. Open the request for details; record measurable results separately in the Sprint.", request._id);
} });
export const coordinate = mutation({ args: { requestId: v.id("supportRequests"), note: v.string(), expectedUpdatedAt: v.optional(v.number()) }, handler: async (ctx, args) => {
  const { profile } = await requireOrganizer(ctx);
  if (!await ctx.db.get(args.requestId) || args.note.length > 3000) throw new ConvexError("Choose a request and keep notes under 3000 characters.");
  const current = await ctx.db.query("supportCoordination").withIndex("by_request", (q) => q.eq("requestId", args.requestId)).unique();
  if (current?.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("Coordination changed. Reopen this request.");
  const patch = { note: args.note.trim(), organizerId: profile._id, updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1) };
  if (current) await ctx.db.patch(current._id, patch); else await ctx.db.insert("supportCoordination", { ...patch, requestId: args.requestId });
} });
export const schedule = mutation({ args: { requestId: v.id("supportRequests"), expectedRevision: v.number(), input: v.object(activityFields), allowOverlap: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const { member, request } = await requestAccess(ctx, args.requestId); revision(request, args.expectedRevision);
  if (member.profile._id !== request.requesterId || request.status !== "agreed") throw new ConvexError("Only the requester can schedule agreed support.");
  const alumnus = await ctx.db.get(request.alumnusId);
  if (!alumnus?.isAlumni || alumnus.suspended) throw new ConvexError("This alumnus is no longer available. Contact an organizer before scheduling.");
  if (request.activityId && await ctx.db.get(request.activityId)) throw new ConvexError("This request already has a Sprint meeting. Edit it in your Sprint.");
  const membership = member.memberships.find((item) => item.cohortId === request.cohortId && item.status === "active"), cohort = await ctx.db.get(request.cohortId);
  if (!membership || !cohort) throw new ConvexError("Your cohort access is unavailable.");
  const parsed = activitySchema.safeParse(args.input);
  if (!parsed.success || parsed.data.kind !== "meeting") throw new ConvexError(parsed.success ? "Agreed support requires a timed meeting." : parsed.error.issues[0].message);
  try { assertInStay(parsed.data, membership.startDateOverride ?? cohort.startDate, membership.endDateOverride ?? cohort.endDate); } catch (error) { throw new ConvexError((error as Error).message); }
  const [personal, shared, progress] = await Promise.all([
    ctx.db.query("sprintActivities").withIndex("by_owner_cohort", (q) => q.eq("ownerId", member.profile._id).eq("cohortId", cohort._id)).collect(),
    ctx.db.query("sprintActivities").withIndex("by_cohort_scope", (q) => q.eq("cohortId", cohort._id).eq("scope", "cohort")).collect(),
    ctx.db.query("sprintProgress").withIndex("by_profile_cohort", (q) => q.eq("profileId", member.profile._id).eq("cohortId", cohort._id)).collect(),
  ]);
  const skipped = new Set(progress.filter((item) => item.status === "skipped").map((item) => item.activityId));
  const conflicts = [...personal, ...shared].filter((item) => !item.cancelledAt && !skipped.has(item._id) && item.startAt !== undefined && item.endAt !== undefined && parsed.data.startAt! < item.endAt && parsed.data.endAt! > item.startAt);
  if (conflicts.length && !args.allowOverlap) throw new ConvexError("This meeting overlaps your Sprint. Choose another time or explicitly keep overlapping time.");
  const activityId = await ctx.db.insert("sprintActivities", { ...parsed.data, cohortId: request.cohortId, ownerId: member.profile._id, scope: "personal", createdBy: member.profile._id, revision: 1, updatedAt: Date.now(), supportRequestId: request._id });
  await ctx.db.patch(request._id, { activityId, revision: request.revision + 1, updatedAt: Date.now() });
  await notify(ctx, request.alumnusId, "The Hustler added your agreed support to their Sprint. Open the request to review the meeting details.", request._id);
  return activityId;
} });

export async function deleteSupportData(ctx: MutationCtx, profileId: Id<"profiles">) {
  const [own, received, offers, notifications, emails] = await Promise.all([
    ctx.db.query("supportRequests").withIndex("by_requester", (q) => q.eq("requesterId", profileId)).collect(),
    ctx.db.query("supportRequests").withIndex("by_alumnus", (q) => q.eq("alumnusId", profileId)).collect(),
    ctx.db.query("alumniOffers").withIndex("by_owner", (q) => q.eq("ownerId", profileId)).collect(),
    ctx.db.query("notifications").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect(),
    ctx.db.query("emailDeliveries").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect(),
  ]);
  for (const request of [...own, ...received]) {
    const [coordination, deliveries] = await Promise.all([
      ctx.db.query("supportCoordination").withIndex("by_request", (q) => q.eq("requestId", request._id)).collect(),
      ctx.db.query("emailDeliveries").withIndex("by_request", (q) => q.eq("requestId", request._id)).collect(),
    ]);
    for (const row of [...coordination, ...deliveries]) await ctx.db.delete(row._id);
    if (request.activityId && await ctx.db.get(request.activityId)) await ctx.db.patch(request.activityId, { supportRequestId: undefined });
    await ctx.db.delete(request._id);
  }
  for (const row of [...offers, ...notifications, ...emails]) if (await ctx.db.get(row._id)) await ctx.db.delete(row._id);
}
