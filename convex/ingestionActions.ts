import { v } from "convex/values";
import { parseLumaCalendar } from "../lib/luma-ical";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { DEFAULT_LUMA_FEED_URL, lumaFeedUrl, MAX_RECORDS, normalizeSerpEvent, SERP_QUERIES, type ImportedRecord } from "../lib/ingestion";

async function body(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), redirect: "error" });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}. Check credentials, allowance, and provider status.`);
  // Bound payloads as well as row counts. Never persist raw provider errors or credentials.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider returned an empty response.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 2_000_000) { await reader.cancel(); throw new Error("Provider response exceeded 2 MB. Reduce the import size."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
function obj(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function safeError(error: unknown) {
  return error instanceof Error && /^Provider (returned HTTP|response exceeded)/.test(error.message) ? error.message : "Import failed or timed out. Existing listings are unchanged. Check provider configuration and try a later refresh.";
}
export const execute = internalAction({ args: { runId: v.id("importRuns") }, handler: async (ctx, { runId }) => {
  const run = await ctx.runMutation(internal.ingestion.claim, { runId });
  if (!run || run.provider === "yc") return;
  try {
    if (run.provider === "luma") {
      const url = lumaFeedUrl(run.feedUrl ?? DEFAULT_LUMA_FEED_URL);
      const calendar = await body(url, { headers: { Accept: "text/calendar" } });
      const result = parseLumaCalendar(calendar, run.startedAt);
      await ctx.runMutation(internal.ingestion.complete, { runId, ...result });
      return;
    }
    const records: ImportedRecord[] = []; let skipped = 0;
    // Each search has a separately reserved unit; never fetch result pagination.
    for (const q of SERP_QUERIES) {
      const params = new URLSearchParams({ engine: "google_events", q, location: "San Francisco, California, United States", hl: "en", gl: "us", api_key: process.env.SERPAPI_API_KEY! });
      const response = obj(JSON.parse(await body(`https://serpapi.com/search.json?${params}`)));
      if (response.error || !Array.isArray(response.events_results)) throw new Error("Invalid SerpApi response.");
      for (const value of response.events_results.slice(0, MAX_RECORDS)) {
        const record = normalizeSerpEvent(value, run.startedAt);
        if (record) records.push(record); else skipped++;
      }
    }
    await ctx.runMutation(internal.ingestion.complete, { runId, records, skipped });
  } catch (error) { await ctx.runMutation(internal.ingestion.fail, { runId, error: safeError(error) }); }
} });
