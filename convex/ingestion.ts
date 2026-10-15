import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { isOrganizerEmail, requireOrganizer } from "./access";
import { providerValidator, importedRecordValidator } from "./ingestionValidators";
import { DEFAULT_LUMA_FEED_URL, lumaFeedUrl, DAY, monthKey, parseYcCsv, providers, SERP_QUERIES, settingsSchema, type ImportedRecord, type ImportProvider } from "../lib/ingestion";
import { opportunityFields } from "./opportunityValidators";
import { opportunitySchema, type OpportunityInput } from "../lib/opportunities";

export function configured(provider: ImportProvider) { return provider === "luma" || !!process.env.SERPAPI_API_KEY; }
async function cadence(ctx: Pick<QueryCtx, "db">) {
  const cohorts = await ctx.db.query("cohorts").collect();
  return cohorts.some((c) => c.status === "upcoming" || c.status === "active") ? DAY : 7 * DAY;
}
export const status = query({
  args: {}, handler: async (ctx) => {
    await requireOrganizer(ctx);
    const interval = await cadence(ctx);
    const sources = await Promise.all(providers.map(async (provider) => {
      const settings = await ctx.db.query("importSettings").withIndex("by_provider", (q) => q.eq("provider", provider)).unique();
      const usage = await ctx.db.query("importUsage").withIndex("by_provider_month", (q) => q.eq("provider", provider).eq("month", monthKey())).unique();
      return { provider, enabled: settings?.enabled ?? false, autoPublish: settings?.autoPublish ?? false,
        monthlyLimit: provider === "serpapi" ? settings?.monthlyLimit ?? 200 : undefined, feedUrl: provider === "luma" ? settings?.feedUrl ?? DEFAULT_LUMA_FEED_URL : undefined, configured: configured(provider),
        reserved: usage?.reserved ?? 0, runs: usage?.runs ?? 0, lastAttemptAt: settings?.lastAttemptAt, lastSuccessAt: settings?.lastSuccessAt,
        stale: !!settings?.lastSuccessAt && Date.now() - settings.lastSuccessAt > interval + DAY,
        activeRunId: settings?.activeRunId, nextDueAt: settings?.enabled ? (settings.lastAttemptAt ?? 0) + interval : undefined };
    }));
    const runs = await ctx.db.query("importRuns").withIndex("by_started").order("desc").take(30);
    return { sources, runs: runs.map(({ _id, provider, trigger, startedAt, finishedAt, status, reservation, autoPublish, error, added, updated, skipped }) => ({ _id, provider, trigger, startedAt, finishedAt, status, reservation, autoPublish, error, added, updated, skipped })), intervalDays: interval / DAY, month: monthKey() };
  },
});
export const configure = mutation({
  args: { provider: providerValidator, enabled: v.boolean(), autoPublish: v.boolean(), monthlyLimit: v.optional(v.number()), feedUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { profile } = await requireOrganizer(ctx);
    const result = settingsSchema.safeParse(args);
    if (!result.success) throw new ConvexError(result.error.issues[0].message);
    if (args.enabled && !configured(args.provider)) throw new ConvexError("Add this provider's key to the Convex environment before enabling imports.");
    const existing = await ctx.db.query("importSettings").withIndex("by_provider", (q) => q.eq("provider", args.provider)).unique();
    const settings = { provider: args.provider, enabled: args.enabled, autoPublish: args.autoPublish, ownerId: profile._id,
      monthlyLimit: args.provider === "serpapi" ? result.data.monthlyLimit : undefined, feedUrl: args.provider === "luma" ? lumaFeedUrl(result.data.feedUrl ?? DEFAULT_LUMA_FEED_URL) : undefined };
    if (existing) await ctx.db.patch(existing._id, settings);
    else await ctx.db.insert("importSettings", settings);
  },
});

async function reserve(ctx: MutationCtx, provider: ImportProvider, trigger: "manual" | "scheduled", ownerId?: Id<"profiles">) {
  const settings = await ctx.db.query("importSettings").withIndex("by_provider", (q) => q.eq("provider", provider)).unique();
  const stop = (message: string): null => { if (trigger === "manual") throw new ConvexError(message); return null; };
  if (!settings?.enabled || !configured(provider)) return stop("Enable and configure this source first.");
  const owner = await ctx.db.get(ownerId ?? settings.ownerId);
  if (!owner || owner.suspended || !isOrganizerEmail(owner.email)) return stop("An active organizer must configure this source again.");
  const now = Date.now();
  if (settings.activeRunId) {
    const active = await ctx.db.get(settings.activeRunId);
    if (active && ["queued", "running"].includes(active.status)) {
      if (now - active.startedAt < 20 * 60_000) return stop("An import is already running for this source.");
      await ctx.db.patch(active._id, { status: "failed", finishedAt: now, error: "Import expired. Existing listings are preserved." });
    }
  }
  if (trigger === "scheduled" || provider === "serpapi") {
    const interval = trigger === "manual" ? 60 * 60_000 : await cadence(ctx);
    if (settings.lastAttemptAt !== undefined && now - settings.lastAttemptAt < interval) return stop("Google Events manual refreshes are limited to once per hour.");
  }
  const month = monthKey(now);
  const usage = await ctx.db.query("importUsage").withIndex("by_provider_month", (q) => q.eq("provider", provider).eq("month", month)).unique();
  const reservation = provider === "luma" ? 0 : SERP_QUERIES.length;
  if (provider === "serpapi" && (usage?.reserved ?? 0) + reservation > (settings.monthlyLimit ?? 200)) return stop("The monthly import allowance is exhausted. Imports resume next month.");
  const runId = await ctx.db.insert("importRuns", { provider, trigger, ownerId: owner._id, startedAt: now, status: "queued", reservation,
    autoPublish: settings.autoPublish, ...(provider === "luma" ? { feedUrl: settings.feedUrl ?? DEFAULT_LUMA_FEED_URL } : {}), added: 0, updated: 0, skipped: 0 });
  if (usage) await ctx.db.patch(usage._id, { reserved: usage.reserved + reservation, runs: usage.runs + 1 });
  else await ctx.db.insert("importUsage", { provider, month, reserved: reservation, runs: 1 });
  await ctx.db.patch(settings._id, { activeRunId: runId, lastAttemptAt: now });
  await ctx.scheduler.runAfter(0, internal.ingestionActions.execute, { runId });
  await ctx.scheduler.runAfter(20 * 60_000, internal.ingestion.expire, { runId });
  return runId;
}
export const refresh = mutation({ args: { provider: providerValidator }, handler: async (ctx, { provider }) => {
  const { profile } = await requireOrganizer(ctx);
  return reserve(ctx, provider, "manual", profile._id);
} });
export const scheduled = internalMutation({ args: {}, handler: async (ctx) => {
  for (const provider of providers) await reserve(ctx, provider, "scheduled");
} });
export const claim = internalMutation({ args: { runId: v.id("importRuns") }, handler: async (ctx, { runId }) => {
  const run = await ctx.db.get(runId);
  if (!run || run.status !== "queued" || run.provider === "yc") return null;
  const settings = await ctx.db.query("importSettings").withIndex("by_provider", (q) => q.eq("provider", run.provider as ImportProvider)).unique();
  const owner = await ctx.db.get(run.ownerId);
  if (!settings?.enabled || !configured(run.provider) || !owner || owner.suspended || !isOrganizerEmail(owner.email)) {
    await finishRun(ctx, run, { status: "failed", error: "Source disabled, missing credentials, or organizer access changed before execution." }); return null;
  }
  await ctx.db.patch(runId, { status: "running" });
  return run;
} });
async function finishRun(ctx: MutationCtx, run: Doc<"importRuns">, fields: Partial<Doc<"importRuns">>) {
  await ctx.db.patch(run._id, { ...fields, finishedAt: Date.now() });
  if (run.provider === "yc") return;
  const settings = await ctx.db.query("importSettings").withIndex("by_provider", (q) => q.eq("provider", run.provider as ImportProvider)).unique();
  if (settings?.activeRunId === run._id) await ctx.db.patch(settings._id, { activeRunId: undefined, ...(fields.status === "succeeded" ? { lastSuccessAt: Date.now() } : {}) });
}
export const fail = internalMutation({ args: { runId: v.id("importRuns"), error: v.string() }, handler: async (ctx, args) => {
  const run = await ctx.db.get(args.runId);
  if (run && ["running", "queued"].includes(run.status)) await finishRun(ctx, run, { status: "failed", error: args.error.slice(0, 300) });
} });
export const expire = internalMutation({ args: { runId: v.id("importRuns") }, handler: async (ctx, { runId }) => {
  const run = await ctx.db.get(runId);
  if (run && ["running", "queued"].includes(run.status) && Date.now() - run.startedAt >= 20 * 60_000) await finishRun(ctx, run, { status: "failed", error: "Import expired. Existing listings are preserved; any search reservation is retained." });
} });

async function upsert(ctx: MutationCtx, run: Doc<"importRuns">, record: ImportedRecord) {
  let source = await ctx.db.query("opportunitySources").withIndex("by_provider_source", (q) => q.eq("provider", run.provider).eq("sourceId", record.sourceId)).unique();
  const urlSources = await ctx.db.query("opportunitySources").withIndex("by_url", (q) => q.eq("canonicalUrl", record.canonicalUrl)).collect();
  source ??= urlSources.find((s) => s.provider === run.provider) ?? null;
  const snapshot = opportunitySchema.parse({ ...record.opportunity, imageUrl: record.opportunity.imageUrl ?? source?.snapshot.imageUrl });
  const byUrl = urlSources[0];
  // A missing upstream cancellation field cannot retract an explicit earlier report.
  const cancelled = record.cancelled ?? source?.cancelled ?? false;
  const direct = await ctx.db.query("opportunities").withIndex("by_kind_source", (q) => q.eq("kind", snapshot.kind).eq("sourceUrl", record.canonicalUrl)).first();
  const legacyUrl = record.canonicalUrl.startsWith("https://luma.com/") ? record.canonicalUrl.replace("https://luma.com/", "https://lu.ma/") : undefined;
  const legacy = !direct && legacyUrl ? await ctx.db.query("opportunities").withIndex("by_kind_source", (q) => q.eq("kind", snapshot.kind).eq("sourceUrl", legacyUrl)).first() : null;
  const targetId = source?.opportunityId ?? byUrl?.opportunityId ?? direct?._id ?? legacy?._id;
  let entry = targetId ? await ctx.db.get(targetId) : null;
  // Multiple providers attach provenance to the same listing. The first source remains authoritative.
  const now = Date.now(); const created = !entry;
  if (!entry) {
    const id = await ctx.db.insert("opportunities", { ...snapshot, status: run.autoPublish && !cancelled ? "published" : "draft", createdBy: run.ownerId, updatedAt: now, importOverrides: [] });
    entry = (await ctx.db.get(id))!;
  }
  const sourceFields = { provider: run.provider, sourceId: record.sourceId, canonicalUrl: record.canonicalUrl, opportunityId: entry._id,
    snapshot, cancelled, approvalRequired: record.approvalRequired, lastImportedAt: now, runId: run._id };
  const changed = !!source && (JSON.stringify(opportunitySchema.parse(source.snapshot)) !== JSON.stringify(snapshot) || source.cancelled !== cancelled || source.approvalRequired !== record.approvalRequired);
  const sourceId = source ? source._id : await ctx.db.insert("opportunitySources", sourceFields);
  if (source) await ctx.db.patch(source._id, sourceFields);
  source = (await ctx.db.get(sourceId))!;
  if (created || !entry.primarySourceId || entry.primarySourceId === sourceId) {
    const overrides = new Set(!created && !entry.primarySourceId ? Object.keys(opportunityFields) : entry.importOverrides ?? []);
    const patch: Partial<OpportunityInput> = {};
    for (const key of Object.keys(opportunityFields) as (keyof OpportunityInput)[]) {
      if (key === "status" || key === "organizerPick" || overrides.has(key)) continue;
      if (key === "imageUrl" && snapshot.imageUrl === undefined) continue;
      Object.assign(patch, { [key]: snapshot[key] });
    }
    await ctx.db.patch(entry._id, { ...patch, primarySourceId: sourceId, importOverrides: [...overrides], lastImportedAt: now, sourceCancelled: cancelled, approvalRequired: record.approvalRequired,
      ...(changed ? { updatedAt: Math.max(now, entry.updatedAt + 1) } : {}) });
  }
  return created ? "added" : changed ? "updated" : "skipped";
}
export const complete = internalMutation({ args: { runId: v.id("importRuns"), records: v.array(importedRecordValidator), skipped: v.number(), cancellations: v.optional(v.array(v.string())) }, handler: async (ctx, args) => {
  const run = await ctx.db.get(args.runId);
  if (!run || run.status !== "running") return;
  if (args.records.length > (run.provider === "serpapi" ? 100 : 50)) throw new ConvexError("Import batch exceeds the limit.");
  const counts = { added: 0, updated: 0, skipped: args.skipped };
  for (const record of args.records) counts[await upsert(ctx, run, record)]++;
  if ((args.cancellations?.length ?? 0) > 50) throw new ConvexError("Cancellation batch exceeds the limit.");
  if (run.provider === "luma") for (const sourceId of args.cancellations ?? []) {
    const source = await ctx.db.query("opportunitySources").withIndex("by_provider_source", (q) => q.eq("provider", "luma").eq("sourceId", sourceId)).unique();
    if (!source || source.cancelled) continue;
    await ctx.db.patch(source._id, { cancelled: true, lastImportedAt: Date.now(), runId: run._id });
    const entry = await ctx.db.get(source.opportunityId);
    if (entry?.primarySourceId === source._id) await ctx.db.patch(entry._id, { sourceCancelled: true, lastImportedAt: Date.now(), updatedAt: Math.max(Date.now(), entry.updatedAt + 1) });
    counts.updated++;
  }
  await finishRun(ctx, run, { ...counts, status: "succeeded" });
} });
export const importYc = mutation({ args: { csv: v.string() }, handler: async (ctx, { csv }) => {
  const { profile } = await requireOrganizer(ctx);
  let records: ImportedRecord[];
  try { records = parseYcCsv(csv); } catch (error) { throw new ConvexError(error instanceof Error ? error.message : "Review the CSV."); }
  const runId = await ctx.db.insert("importRuns", { provider: "yc", trigger: "csv", ownerId: profile._id, startedAt: Date.now(), status: "running", reservation: 0, autoPublish: false, added: 0, updated: 0, skipped: 0 });
  const run = (await ctx.db.get(runId))!;
  const counts = { added: 0, updated: 0, skipped: 0 };
  for (const record of records) counts[await upsert(ctx, run, record)]++;
  await finishRun(ctx, run, { status: "succeeded", ...counts }); return counts;
} });
export const provenance = query({ args: { opportunityId: v.id("opportunities") }, handler: async (ctx, { opportunityId }) => {
  await requireOrganizer(ctx);
  return ctx.db.query("opportunitySources").withIndex("by_opportunity", (q) => q.eq("opportunityId", opportunityId)).collect();
} });
export const restoreFields = mutation({ args: { opportunityId: v.id("opportunities"), expectedUpdatedAt: v.number() }, handler: async (ctx, args) => {
  await requireOrganizer(ctx);
  const entry = await ctx.db.get(args.opportunityId);
  if (!entry?.primarySourceId || entry.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("This listing changed. Reopen source details before restoring fields.");
  const source = await ctx.db.get(entry.primarySourceId);
  if (!source) throw new ConvexError("The source record is unavailable.");
  const patch: Partial<OpportunityInput> = {};
  for (const key of Object.keys(opportunityFields) as (keyof OpportunityInput)[]) {
    if (key !== "status" && key !== "organizerPick") Object.assign(patch, { [key]: source.snapshot[key] });
  }
  await ctx.db.patch(entry._id, { ...patch, importOverrides: [], updatedAt: Math.max(Date.now(), entry.updatedAt + 1) });
} });
