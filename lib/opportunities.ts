import { z } from "zod";
import { TZDate } from "@date-fns/tz";
import { dateLabel, SF_TIMEZONE } from "./cohort-dates";
import { lumaImageUrl } from "./luma-images";

export const opportunityKinds = ["event", "startup", "founder", "alumni"] as const;
export const kindLabels = { event: "Event", startup: "Startup", founder: "Founder", alumni: "Alumni offer" };
export const missionCategories = ["connect", "feedback", "learn", "give-back"] as const;
export type MissionCategory = typeof missionCategories[number];
export const categoryLabels: Record<MissionCategory, string> = { connect: "Meet people", feedback: "Get feedback", learn: "Learn & build", "give-back": "Offer support" };

export function canonicalSource(value: string) {
  const url = new URL(value);
  if (["lu.ma", "www.lu.ma", "www.luma.com"].includes(url.hostname)) url.hostname = "luma.com";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString().replace(/\/$/, "");
}

const webUrl = z.string().trim().max(2000).refine((value) => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}, "Use a full https:// or http:// source link.").transform(canonicalSource);

export const opportunitySchema = z.object({
  kind: z.enum(opportunityKinds),
  title: z.string().trim().min(3, "Add a title with at least 3 characters.").max(120),
  summary: z.string().trim().min(10, "Add a summary with at least 10 characters.").max(240),
  description: z.string().trim().min(20, "Add details with at least 20 characters.").max(5000),
  interests: z.array(z.string().trim().min(1).max(80)).min(1, "Choose at least one interest.").max(8).transform((items) => [...new Set(items)]),
  categories: z.array(z.enum(missionCategories)).max(4).transform((items) => [...new Set(items)]),
  area: z.enum(["sf", "bay-area", "online"]),
  location: z.string().trim().min(2, "Add a location or online venue.").max(160),
  sourceName: z.string().trim().min(2, "Name the original source.").max(100),
  sourceUrl: webUrl,
  imageUrl: z.string().refine((value) => !!lumaImageUrl(value), "Use an HTTPS image from Luma’s CDN or Unsplash.").optional(),
  organizerPick: z.boolean(),
  status: z.enum(["draft", "published", "archived"]),
  startAt: z.number().int().min(0).max(8_640_000_000_000_000).optional(),
  endAt: z.number().int().min(0).max(8_640_000_000_000_000).optional(),
  eventDate: z.iso.date().optional(), eventEndDate: z.iso.date().optional(),
  cost: z.enum(["free", "paid", "unknown"]).optional(),
  costNote: z.string().trim().max(160).optional(),
  support: z.object({
    offeredBy: z.string().trim().min(2, "Name the alumnus offering support.").max(100),
    pathway: z.string().trim().min(10, "Describe the support and how to request it.").max(1000),
    url: webUrl,
    availability: z.string().trim().min(5, "Describe availability or capacity.").max(240),
  }).optional(),
}).superRefine((value, ctx) => {
  if (value.kind === "event") {
    if (value.startAt === undefined && !value.eventDate) ctx.addIssue({ code: "custom", path: ["startAt"], message: "Set the event start time or an all-day date." });
    if (value.eventDate && (value.startAt !== undefined || value.endAt !== undefined)) ctx.addIssue({ code: "custom", message: "Use all-day dates or event times, not both." });
    if (value.eventEndDate && (!value.eventDate || value.eventEndDate <= value.eventDate)) ctx.addIssue({ code: "custom", message: "The all-day end date must follow the start date." });
    if (!value.cost) ctx.addIssue({ code: "custom", path: ["cost"], message: "Choose free, paid, or price not confirmed." });
    if (value.endAt !== undefined && (value.startAt === undefined || value.endAt <= value.startAt)) ctx.addIssue({ code: "custom", path: ["endAt"], message: "Set the end time after the start time." });
  } else if (value.startAt !== undefined || value.endAt !== undefined || value.eventDate !== undefined || value.eventEndDate !== undefined || value.cost !== undefined || value.costNote !== undefined) {
    ctx.addIssue({ code: "custom", message: "Dates and pricing belong to events. Remove them from this listing." });
  }
  if (value.kind === "alumni" && !value.support) ctx.addIssue({ code: "custom", path: ["support"], message: "Add a confirmed support path for this alumni offer." });
  if (value.kind !== "alumni" && value.support) ctx.addIssue({ code: "custom", path: ["support"], message: "Support offers must use the Alumni offer type." });
});

export type OpportunityInput = z.infer<typeof opportunitySchema>;
export type Opportunity = OpportunityInput & { _id: string; saved: boolean; updatedAt: number; supportConfirmedAt?: number; isSample?: boolean;
  lastImportedAt?: number; sourceCancelled?: boolean; sourceStale?: boolean; approvalRequired?: boolean; importOverrides?: string[]; primarySourceId?: string };
export type RecommendationContext = { interests: string[]; categories: MissionCategory[]; startDate?: string; endDate?: string };

export function isUpcomingOpportunity(entry: Pick<OpportunityInput, "kind" | "startAt" | "eventDate">, now: number) {
  if (entry.kind !== "event") return true;
  if (entry.startAt !== undefined) return entry.startAt > now;
  return !!entry.eventDate && entry.eventDate >= sfCalendarDate(now);
}

export function categoriesFromGoals(goals: { title: string; metric: string; firstActions: string[] }[]): MissionCategory[] {
  const text = goals.map((goal) => [goal.title, goal.metric, ...goal.firstActions].join(" ")).join(" ").toLowerCase();
  const rules: Record<MissionCategory, RegExp> = {
    connect: /\b(meet\w*|network\w*|connect\w*|events?|people|conversations?)\b/,
    feedback: /\b(feedback|validat\w*|test\w*|users?|prototype\w*)\b/,
    learn: /\b(learn\w*|workshops?|technical|skills?|build\w*|develop\w*)\b/,
    "give-back": /\b(mentor\w*|support\w*|offer\w*|give|help\w*)\b/,
  };
  return missionCategories.filter((category) => rules[category].test(text));
}

const sfDate = new Intl.DateTimeFormat("en-CA", { timeZone: SF_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function sfCalendarDate(timestamp: number) {
  const parts = sfDate.formatToParts(timestamp);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("-");
}
export function sfDateTimeInput(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SF_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(timestamp);
  return `${sfCalendarDate(timestamp)}T${parts}`;
}
export function parseSfDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a valid event date and time.");
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  const timestamp = new TZDate(year, month - 1, day, hour, minute, 0, 0, SF_TIMEZONE).getTime();
  if (!Number.isFinite(timestamp) || sfDateTimeInput(timestamp) !== value) throw new Error("This time does not exist in San Francisco. Choose another time.");
  return timestamp;
}
export function eventTimeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { timeZone: SF_TIMEZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(timestamp);
}
export const costLabels = { free: "Free", paid: "Paid", unknown: "Price not confirmed" };
export function opportunityDate(entry: OpportunityInput) { return entry.eventDate ?? (entry.startAt === undefined ? undefined : sfCalendarDate(entry.startAt)); }
export function opportunitySortTime(entry: OpportunityInput) { return entry.startAt ?? (entry.eventDate ? parseSfDateTime(`${entry.eventDate}T00:00`) : Infinity); }
export function opportunityTimeLabel(entry: OpportunityInput) {
  if (entry.eventDate) {
    const last = entry.eventEndDate ? new Date(Date.parse(`${entry.eventEndDate}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : entry.eventDate;
    return `${dateLabel(entry.eventDate)}${last !== entry.eventDate ? ` – ${dateLabel(last)}` : ""} · All day`;
  }
  return entry.startAt === undefined ? "Time not confirmed" : eventTimeLabel(entry.startAt);
}

export function matchOpportunity(entry: OpportunityInput, context: RecommendationContext) {
  const matchingInterests = entry.interests.filter((interest) => context.interests.some((item) => item.toLowerCase() === interest.toLowerCase()));
  const category = entry.categories.find((item) => context.categories.includes(item));
  const date = opportunityDate(entry);
  const duringStay = entry.kind === "event" && !!date && !!context.startDate && !!context.endDate && date >= context.startDate && date <= context.endDate;
  const reasons = [
    ...matchingInterests.slice(0, 2).map((interest) => `Matches ${interest}`),
    ...(duringStay ? ["During your stay"] : []),
    ...(category ? [`Supports your mission: ${categoryLabels[category].toLowerCase()}`] : []),
    ...(entry.organizerPick ? ["Organizer pick"] : []),
  ];
  return { score: matchingInterests.length * 6 + (duringStay ? 5 : 0) + (category ? 2 : 0) + (entry.organizerPick ? 3 : 0), reasons };
}

export type OpportunityFilters = {
  search: string; kind: "all" | OpportunityInput["kind"]; area: "sf" | "bay-area" | "online" | "all";
  interest: string; cost: "any" | NonNullable<OpportunityInput["cost"]>; from: string; to: string; savedOnly: boolean;
};
export const defaultOpportunityFilters: OpportunityFilters = { search: "", kind: "all", area: "sf", interest: "", cost: "any", from: "", to: "", savedOnly: false };
export function filterOpportunities(entries: Opportunity[], filters: OpportunityFilters) {
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (filters.kind !== "all" && entry.kind !== filters.kind) return false;
    if (filters.savedOnly && !entry.saved) return false;
    if (filters.area === "sf" && entry.area !== "sf") return false;
    if (filters.area === "bay-area" && entry.area === "online") return false;
    if (filters.area === "online" && entry.area !== "online") return false;
    if (filters.interest && !entry.interests.includes(filters.interest)) return false;
    const text = [entry.title, entry.summary, entry.description, entry.location, entry.sourceName, entry.support?.offeredBy, ...entry.interests].join(" ").toLowerCase();
    if (!terms.every((term) => text.includes(term))) return false;
    if (entry.kind === "event") {
      if (filters.cost !== "any" && entry.cost !== filters.cost) return false;
      const date = opportunityDate(entry) ?? "";
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
    }
    return true;
  });
}
