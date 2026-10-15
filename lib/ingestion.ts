import { z } from "zod";
import { canonicalSource, opportunitySchema, parseSfDateTime, sfCalendarDate, type OpportunityInput } from "./opportunities";
import { sfTimeCandidates } from "./sprint-time";

export const providers = ["luma", "serpapi"] as const;
export type ImportProvider = typeof providers[number];
export const providerLabels = { luma: "Luma · iCal", serpapi: "Google Events · SerpApi", yc: "YC directory CSV" };
export const DAY = 86_400_000;
export const MAX_RECORDS = 50;
export const DEFAULT_LUMA_FEED_URL = "https://api.luma.com/ics/get?entity=discover&id=discplace-BDj7GNbGlsF7Cka";
export function lumaFeedUrl(value: string) {
  const url = new URL(value.replace(/^webcal:/i, "https:"));
  if (url.protocol !== "https:" || !["api.luma.com", "api.lu.ma"].includes(url.hostname) || url.port || url.username || url.password || url.pathname !== "/ics/get" || url.hash ||
    !["discover", "calendar"].includes(url.searchParams.get("entity") ?? "") || !/^[\w-]{1,160}$/.test(url.searchParams.get("id") ?? "") ||
    [...url.searchParams.keys()].some((key) => !["entity", "id"].includes(key)) || [...url.searchParams].length !== 2) throw new Error("Use a public Luma city or calendar iCal subscription URL.");
  url.hostname = "api.luma.com";
  url.searchParams.sort(); return url.toString();
}
export const SERP_QUERIES = ["startup founder events in San Francisco", "startup demo day hackathon events in Bay Area"];
export const settingsSchema = z.object({
  provider: z.enum(providers), enabled: z.boolean(),
  monthlyLimit: z.number().int().min(2).max(200).optional(), autoPublish: z.boolean(), feedUrl: z.string().trim().max(2000).optional(),
}).superRefine((s, ctx) => {
  if (s.provider === "serpapi" && s.monthlyLimit === undefined) ctx.addIssue({ code: "custom", message: "Set a monthly allowance of 2–200 SerpApi searches." });
  if (s.provider === "luma") try { lumaFeedUrl(s.feedUrl ?? DEFAULT_LUMA_FEED_URL); } catch { ctx.addIssue({ code: "custom", message: "Use a public Luma city or calendar iCal subscription URL." }); }
});
export function monthKey(now = Date.now()) { return new Date(now).toISOString().slice(0, 7); }
export function importUrl(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid source URL.");
  if (["lu.ma", "www.lu.ma", "www.luma.com"].includes(url.hostname)) url.hostname = "luma.com";
  return canonicalSource(url.toString());
}
export type ImportedRecord = { sourceId: string; canonicalUrl: string; opportunity: OpportunityInput; cancelled?: boolean; approvalRequired?: boolean };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
function isoTime(value: unknown) {
  // Never interpret a timezone-free provider timestamp in the server's local timezone.
  const s = str(value);
  return /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) && Number.isFinite(Date.parse(s)) ? Date.parse(s) : undefined;
}
function serpTime(value: unknown, now: number) {
  const iso = isoTime(value);
  if (iso !== undefined) return iso;
  const s = str(value).replace(/\s+/g, " ");
  const m = s.match(/^([A-Za-z]{3}) (\d{1,2})(?:,? (20\d{2}))?,? (\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return undefined;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].toLowerCase()) + 1;
  const hour = Number(m[4]);
  if (!month || hour < 1 || hour > 12) return undefined;
  const currentYear = Number(sfCalendarDate(now).slice(0, 4));
  for (const year of m[3] ? [Number(m[3])] : [currentYear, currentYear + 1]) {
    const input = `${year}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}T${String(hour % 12 + (m[6].toUpperCase() === "PM" ? 12 : 0)).padStart(2, "0")}:${m[5]}`;
    try {
      // Ambiguous fall-back times need organizer curation rather than a guessed offset.
      if (sfTimeCandidates(input).length !== 1) continue;
      const time = parseSfDateTime(input);
      if (time >= now && time <= now + 30 * DAY) return time;
    } catch { /* Skip dates that cannot be represented in SF. */ }
  }
}

export function normalizeSerpEvent(value: unknown, now: number): ImportedRecord | null {
  const r = object(value);
  const title = str(r.title).slice(0, 120);
  const tickets = Array.isArray(r.ticket_info) ? r.ticket_info : [];
  const link = str(r.link) || str(object(tickets[0]).link);
  const startAt = serpTime(object(r.date).when, now);
  if (!link || startAt === undefined || startAt < now || startAt > now + 30 * DAY) return null;
  try {
    const canonicalUrl = importUrl(link);
    const address = Array.isArray(r.address) ? r.address.map(str).filter(Boolean) : [];
    // SerpApi puts the venue before the locality. Classify by the locality so an
    // SF event stays visible in the default filter, regardless of its venue name.
    const city = str(r.addressCity) || address.at(-1) || str(r.addressRegion);
    const online = r.isOnline === true;
    // A geographically targeted search is not evidence that every returned event is local.
    const locality = city.split(",")[0].trim();
    if (!online && !/^(?:san francisco|bay area|oakland|berkeley|palo alto|san jose|mountain view|redwood city|san mateo|sunnyvale|menlo park|south san francisco)$/i.test(locality)) return null;
    const venue = str(r.venue) || str(object(r.venue).name) || str(r.venueName);
    const location = online ? "Online" : (venue ? `${venue}${city ? ` · ${city}` : ""}` : city ? `${city} · venue not announced` : "Venue not announced").slice(0, 160);
    const cost = r.isFree === true || (typeof r.extracted_price === "number" && r.extracted_price === 0) ? "free" : r.isFree === false || (typeof r.price === "number" && r.price > 0) || (typeof r.extracted_price === "number" && r.extracted_price > 0) ? "paid" : "unknown";
    const approvalRequired = typeof r.approvalRequired === "boolean" ? r.approvalRequired : typeof r.requiresApproval === "boolean" ? r.requiresApproval : undefined;
    const description = (str(r.description) || `${title}. Check the original registration page for event details and current availability.`).slice(0, 4800);
    const interests = /\bai\b|artificial intelligence/i.test(`${title} ${description}`) ? ["AI & machine learning"] : ["Other"];
    const end = isoTime(r.endAt);
    const opportunity = opportunitySchema.parse({ kind: "event", title, summary: description.slice(0, 240), description,
      interests, categories: ["connect", "learn"], area: online ? "online" : /^san francisco$/i.test(locality) ? "sf" : "bay-area",
      location, sourceName: "Google Events", sourceUrl: canonicalUrl, organizerPick: false, status: "draft", startAt,
      ...(end !== undefined && end > startAt ? { endAt: end } : {}), cost,
      costNote: (typeof r.price === "number" ? `${r.currency ? str(r.currency) : "Currency unconfirmed"} ${r.price}` : str(r.price) || "").slice(0, 160),
    });
    const cancelled = typeof r.isCancelled === "boolean" ? r.isCancelled : r.status === "cancelled" || r.status === "canceled" ? true : undefined;
    return { sourceId: (str(r.eventId) || str(r.id) || canonicalUrl).slice(0, 2000), canonicalUrl, opportunity,
      ...(cancelled === undefined ? {} : { cancelled }), ...(approvalRequired === undefined ? {} : { approvalRequired }) };
  } catch { return null; }
}

// Bounded RFC 4180 parser: handles escaped quotes, CRLF and embedded newlines.
export function parseYcCsv(text: string): ImportedRecord[] {
  if (text.length > 200_000) throw new Error("Use a CSV smaller than 200 KB.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else if (c === undefined) throw new Error("Close the quoted field in your CSV.");
      else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === "," || c === "\n" || c === undefined || c === "\r") {
      row.push(cell); cell = ""; closed = false;
      if (c !== ",") { if (row.some(Boolean)) rows.push(row); row = []; if (c === "\r" && text[i + 1] === "\n") i++; }
    } else { if (closed || c === '"') throw new Error("Review the quoting in your CSV."); cell += c; }
    if (rows.length > 51) throw new Error("Import at most 50 YC entries at a time.");
  }
  const headers = rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase()) ?? [];
  const required = ["title", "summary", "description", "sourceurl", "interests", "area", "location"];
  if (!required.every((h) => headers.includes(h)) || new Set(headers).size !== headers.length) throw new Error(`Use unique headers including: ${required.join(", ")}.`);
  if (!rows.length) throw new Error("Add at least one YC entry.");
  return rows.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Row ${index + 2}: the number of fields does not match the headers.`);
    const r = Object.fromEntries(headers.map((h, i) => [h, cells[i].trim()]));
    try {
      const url = new URL(r.sourceurl);
      if (url.protocol !== "https:" || url.port || !["www.ycombinator.com", "ycombinator.com"].includes(url.hostname) || !/^\/companies\/[^/]+\/?$/.test(url.pathname)) throw new Error("Use the original HTTPS YC company directory link.");
      url.hostname = "www.ycombinator.com";
      const opportunity = opportunitySchema.parse({ kind: "startup", title: r.title, summary: r.summary, description: r.description,
        sourceUrl: url.toString(), sourceName: "Y Combinator", interests: r.interests.split("|").filter(Boolean), area: r.area,
        location: r.location, categories: [], organizerPick: false, status: "draft" });
      return { sourceId: opportunity.sourceUrl, canonicalUrl: opportunity.sourceUrl, opportunity, cancelled: false };
    } catch (error) { throw new Error(`Row ${index + 2}: ${error instanceof Error ? error.message : "Review this entry."}`); }
  });
}
