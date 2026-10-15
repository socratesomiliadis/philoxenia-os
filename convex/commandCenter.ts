import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isOrganizerEmail, requireMember, requireOrganizer } from "./access";
import { attentionFlags, UNANSWERED_REQUEST_MS } from "../lib/command-center";
import { sfCalendarDate } from "../lib/opportunities";

export const ownCheckin = query({ args: { cohortId: v.id("cohorts") }, handler: async (ctx, { cohortId }) => {
  const member = await requireMember(ctx);
  if (!member.memberships.some((m) => m.cohortId === cohortId && m.status === "active")) throw new ConvexError("An active cohort membership is required.");
  return ctx.db.query("helpCheckins").withIndex("by_profile_cohort", (q) => q.eq("profileId", member.profile._id).eq("cohortId", cohortId)).unique();
} });

export const checkIn = mutation({ args: { cohortId: v.id("cohorts"), message: v.string(), expectedRevision: v.number() }, handler: async (ctx, args) => {
  const { profile, memberships } = await requireMember(ctx);
  const cohort = await ctx.db.get(args.cohortId);
  if (!cohort || cohort.status === "completed" || !memberships.some((m) => m.cohortId === args.cohortId && m.status === "active")) throw new ConvexError("An active membership in an upcoming or active cohort is required.");
  const message = args.message.trim();
  if (message.length < 5 || message.length > 2000) throw new ConvexError("Describe the help you need in 5–2,000 characters.");
  const current = await ctx.db.query("helpCheckins").withIndex("by_profile_cohort", (q) => q.eq("profileId", profile._id).eq("cohortId", args.cohortId)).unique();
  if ((current?.revision ?? 0) !== args.expectedRevision) throw new ConvexError("Your check-in changed. Reopen it and try again.");
  const patch = { message, status: "open" as const, revision: (current?.revision ?? 0) + 1, updatedAt: Date.now(), resolvedAt: undefined, resolvedBy: undefined };
  if (current) await ctx.db.patch(current._id, patch);
  else {
    await ctx.db.insert("helpCheckins", { profileId: profile._id, cohortId: args.cohortId, ...patch });
  }
  if (current?.status !== "open") {
    const organizers = (await ctx.db.query("profiles").collect()).filter((p) => !p.suspended && isOrganizerEmail(p.email));
    for (const organizer of organizers) await ctx.db.insert("notifications", { profileId: organizer._id, message: "A participant asked for help. Open the Command Center to review cohort check-ins.", createdAt: Date.now() });
  }
} });

export const resolveCheckin = mutation({ args: { checkinId: v.id("helpCheckins"), expectedRevision: v.number() }, handler: async (ctx, args) => {
  const member = await requireMember(ctx);
  const checkin = await ctx.db.get(args.checkinId);
  if (!checkin || (!member.isOrganizer && (checkin.profileId !== member.profile._id || !member.memberships.some((m) => m.cohortId === checkin.cohortId && m.status === "active")))) throw new ConvexError("This check-in is unavailable.");
  if (checkin.revision !== args.expectedRevision || checkin.status !== "open") throw new ConvexError("This check-in changed. Reopen it and try again.");
  await ctx.db.patch(checkin._id, { status: "resolved", revision: checkin.revision + 1, resolvedBy: member.profile._id, resolvedAt: Date.now(), updatedAt: Date.now() });
} });

export const saveNote = mutation({ args: { profileId: v.id("profiles"), cohortId: v.id("cohorts"), note: v.string(), expectedRevision: v.number() }, handler: async (ctx, args) => {
  const { profile } = await requireOrganizer(ctx);
  if (args.note.length > 3000) throw new ConvexError("Keep notes under 3,000 characters.");
  const membership = await ctx.db.query("memberships").withIndex("by_profile_cohort", (q) => q.eq("profileId", args.profileId).eq("cohortId", args.cohortId)).unique();
  if (!membership || !await ctx.db.get(args.profileId)) throw new ConvexError("Participant not found in this cohort.");
  const current = await ctx.db.query("participantNotes").withIndex("by_profile_cohort", (q) => q.eq("profileId", args.profileId).eq("cohortId", args.cohortId)).unique();
  if ((current?.revision ?? 0) !== args.expectedRevision) throw new ConvexError("Another organizer changed this note. Reopen it before saving.");
  const patch = { organizerId: profile._id, note: args.note.trim(), revision: (current?.revision ?? 0) + 1, updatedAt: Date.now() };
  if (current) await ctx.db.patch(current._id, patch);
  else await ctx.db.insert("participantNotes", { profileId: args.profileId, cohortId: args.cohortId, ...patch });
} });

export const cohortSummary = query({ args: { cohortId: v.id("cohorts"), refreshKey: v.optional(v.number()) }, handler: async (ctx, { cohortId }) => {
  await requireOrganizer(ctx);
  const cohort = await ctx.db.get(cohortId);
  if (!cohort) throw new ConvexError("Cohort not found.");
  const [memberships, shared, requests, invitations] = await Promise.all([
    ctx.db.query("memberships").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect(),
    ctx.db.query("sprintActivities").withIndex("by_cohort_scope", (q) => q.eq("cohortId", cohortId).eq("scope", "cohort")).collect(),
    ctx.db.query("supportRequests").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect(),
    ctx.db.query("invitations").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect(),
  ]);
  const now = Date.now(), today = sfCalendarDate(now);
  const people = await Promise.all(memberships.map(async (membership) => {
    const profile = await ctx.db.get(membership.profileId);
    if (!profile) return null;
    const byPerson = { profileId: profile._id, cohortId };
    const [mission, activities, progress, outcomes, checkin, note] = await Promise.all([
      ctx.db.query("onboarding").withIndex("by_profile_cohort", (q) => q.eq("profileId", byPerson.profileId).eq("cohortId", cohortId)).unique(),
      ctx.db.query("sprintActivities").withIndex("by_owner_cohort", (q) => q.eq("ownerId", byPerson.profileId).eq("cohortId", cohortId)).collect(),
      ctx.db.query("sprintProgress").withIndex("by_profile_cohort", (q) => q.eq("profileId", byPerson.profileId).eq("cohortId", cohortId)).collect(),
      ctx.db.query("sprintOutcomes").withIndex("by_profile_cohort", (q) => q.eq("profileId", byPerson.profileId).eq("cohortId", cohortId)).collect(),
      ctx.db.query("helpCheckins").withIndex("by_profile_cohort", (q) => q.eq("profileId", byPerson.profileId).eq("cohortId", cohortId)).unique(),
      ctx.db.query("participantNotes").withIndex("by_profile_cohort", (q) => q.eq("profileId", byPerson.profileId).eq("cohortId", cohortId)).unique(),
    ]);
    const participation = new Map(progress.map((p) => [p.activityId, p]));
    const entries = [...shared, ...activities].filter((a) => a.cancelledAt === undefined).map((a) => ({ id: a._id, title: a.title, kind: a.kind, scope: a.scope, day: a.day, startAt: a.startAt, endAt: a.endAt, status: participation.get(a._id)?.status ?? "planned", contribution: participation.get(a._id)?.contribution ?? 0, goalLink: participation.get(a._id)?.goalLink }));
    const goals = mission?.confirmedGoals ?? [];
    const totals = goals.map((_, index) => entries.reduce((sum, entry) => sum + (entry.status === "completed" && mission?.confirmedAt !== undefined && entry.goalLink?.missionConfirmedAt === mission.confirmedAt && entry.goalLink.index === index ? entry.contribution : 0), 0));
    const ownRequests = requests.filter((r) => r.requesterId === profile._id);
    const unansweredRequests = ownRequests.filter((r) => r.status === "pending" && now - r._creationTime >= UNANSWERED_REQUEST_MS).length;
    const startDate = membership.startDateOverride ?? cohort.startDate;
    const eligible = membership.status === "active" && !profile.suspended;
    const flags = eligible ? attentionFlags({ help: checkin?.status === "open" ? checkin.message : undefined, confirmed: mission?.confirmedAt !== undefined && goals.length === 3, completedCohort: cohort.status === "completed", today, goals, totals, unansweredRequests }) : [];
    const author = note ? await ctx.db.get(note.organizerId) : null;
    return { profileId: profile._id, name: profile.name, email: profile.email, alumni: profile.isAlumni, suspended: profile.suspended, membershipStatus: membership.status,
      startDate, endDate: membership.endDateOverride ?? cohort.endDate, confirmedAt: mission?.confirmedAt, goals, totals, entries, outcomes, checkin, note: note ? { ...note, organizerName: author?.name ?? "Former organizer" } : null, flags,
      pendingRequests: ownRequests.filter((r) => r.status === "pending").length, unansweredRequests,
    };
  }));
  const participants = people.filter((p) => p !== null).sort((a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name));
  const active = participants.filter((p) => p.membershipStatus === "active" && !p.suspended);
  return { cohort, asOf: now, participants, summary: { active: active.length, onboardingIncomplete: active.filter((p) => p.confirmedAt === undefined || p.goals.length !== 3).length,
    needingAttention: active.filter((p) => p.flags.length > 0).length, openCheckins: active.filter((p) => p.checkin?.status === "open").length,
    plannedMeetings: active.reduce((n, p) => n + p.entries.filter((a) => a.kind === "meeting" && a.startAt !== undefined && a.status === "planned").length, 0),
    completedActivities: active.reduce((n, p) => n + p.entries.filter((a) => a.status === "completed").length, 0),
    reportedOutcomes: active.reduce((n, p) => n + p.outcomes.length, 0), pendingRequests: requests.filter((r) => r.status === "pending").length,
    pendingInvitations: invitations.filter((i) => i.status === "pending").length },
  };
} });

export const operations = query({ args: {}, handler: async (ctx) => {
  await requireOrganizer(ctx);
  const deliveries = await ctx.db.query("emailDeliveries").order("desc").take(50);
  const runs = await ctx.db.query("importRuns").withIndex("by_started").order("desc").take(20);
  const organizerCount = (await ctx.db.query("profiles").collect()).filter((p) => !p.suspended && isOrganizerEmail(p.email)).length;
  return { oauthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.SITE_URL),
    httpsSite: /^https:\/\//.test(process.env.SITE_URL ?? ""), organizerCount,
    failedEmails: deliveries.filter((d) => d.status === "failed").length, disabledEmails: deliveries.filter((d) => d.status === "disabled").length,
    failedImports: runs.filter((r) => r.status === "failed").length,
    stuckImports: runs.filter((r) => ["queued", "running"].includes(r.status) && Date.now() - r.startedAt > 20 * 60_000).length,
  };
} });
