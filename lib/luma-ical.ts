import ICAL from "ical.js";
import { DAY, importUrl, MAX_RECORDS, type ImportedRecord } from "./ingestion";
import { opportunitySchema, sfCalendarDate } from "./opportunities";
import { sfTimeCandidates } from "./sprint-time";

function text(component: InstanceType<typeof ICAL.Component>, name: string) {
  const value = component.getFirstPropertyValue(name);
  return typeof value === "string" ? value.trim() : "";
}
function timestamp(component: InstanceType<typeof ICAL.Component>, name: string) {
  const property = component.getFirstProperty(name);
  const value = property?.getFirstValue();
  if (!(value instanceof ICAL.Time) || value.isDate) return undefined;
  const zone = property!.getParameter("tzid");
  if (value.zone === ICAL.Timezone.utcTimezone) return value.toUnixTime() * 1000;
  if (zone === "America/Los_Angeles") {
    const candidates = sfTimeCandidates(value.toString().slice(0, 16));
    return candidates.length === 1 ? candidates[0] + value.second * 1000 : undefined;
  }
  // Embedded VTIMEZONE definitions are resolved by ical.js through the parent calendar.
  if (typeof zone === "string" && value.zone.tzid === zone && value.zone !== ICAL.Timezone.localTimezone) return value.toUnixTime() * 1000;
  return undefined;
}
function registrationLink(component: InstanceType<typeof ICAL.Component>, description: string) {
  const candidates = [text(component, "url"), ...(description.match(/https?:\/\/(?:luma\.com|lu\.ma)\/[^\s<>"\\]+/gi) ?? [])];
  for (const candidate of candidates) try {
    const url = new URL(candidate.replace(/[).,;]+$/, ""));
    if (["luma.com", "lu.ma", "www.luma.com", "www.lu.ma"].includes(url.hostname) && /^\/[\w-]+\/?$/.test(url.pathname)) return importUrl(url.toString());
  } catch { /* A malformed description link must not replace the original registration page. */ }
}

export function parseLumaCalendar(input: string, now: number) {
  if (input.length > 2_000_000 || !/^BEGIN:VCALENDAR\s*$/im.test(input) || !/^END:VCALENDAR\s*$/im.test(input)) throw new Error("Luma returned an invalid or oversized iCal calendar.");
  const calendar = new ICAL.Component(ICAL.parse(input));
  if (calendar.name !== "vcalendar") throw new Error("Luma returned an invalid iCal calendar.");
  const events = calendar.getAllSubcomponents("vevent");
  if (events.length > 1000) throw new Error("Luma returned too many calendar entries.");
  // Repeated UIDs are revisions, not new opportunities. Prefer the highest sequence.
  const latest = new Map<string, { component: InstanceType<typeof ICAL.Component>; sequence: number; stamp: number }>();
  let skipped = 0;
  for (const component of events) {
    const uid = text(component, "uid");
    if (!uid || uid.length > 2000 || component.hasProperty("recurrence-id") || component.hasProperty("rrule") || component.hasProperty("rdate")) { skipped++; continue; }
    const sequence = Number(component.getFirstPropertyValue("sequence") ?? 0);
    const stamp = timestamp(component, "last-modified") ?? timestamp(component, "dtstamp") ?? 0;
    const previous = latest.get(uid);
    if (!previous || sequence > previous.sequence || (sequence === previous.sequence && stamp >= previous.stamp)) latest.set(uid, { component, sequence, stamp });
    if (previous) skipped++;
  }
  const records: ImportedRecord[] = []; const cancellations: string[] = [];
  for (const [uid, { component }] of latest) {
    const status = text(component, "status").toUpperCase();
    const cancelled = status === "CANCELLED" || text(calendar, "method").toUpperCase() === "CANCEL";
    if (cancelled) {
      if (cancellations.length < MAX_RECORDS) cancellations.push(uid); else skipped++;
    }
    try {
      const start = component.getFirstPropertyValue("dtstart");
      const description = text(component, "description");
      const canonicalUrl = registrationLink(component, description);
      if (!(start instanceof ICAL.Time) || !canonicalUrl) { if (!cancelled) skipped++; continue; }
      const title = text(component, "summary").slice(0, 120);
      const cleanDescription = description.replace(/^Get up-to-date information at:\s*https?:\/\/[^\s]+\s*/i, "").trim();
      const details = (cleanDescription.length >= 20 ? cleanDescription : `${title}. Check the original registration page for event details and availability.`).slice(0, 5000);
      const allDay = start.isDate;
      const startAt = allDay ? undefined : timestamp(component, "dtstart");
      const date = allDay ? start.toString() : startAt === undefined ? undefined : sfCalendarDate(startAt);
      if (!date || (allDay ? date < sfCalendarDate(now) || date > sfCalendarDate(now + 30 * DAY) : startAt! < now || startAt! > now + 30 * DAY)) { if (!cancelled) skipped++; continue; }
      const end = component.getFirstPropertyValue("dtend");
      let endAt = timestamp(component, "dtend");
      if (!allDay && !end && component.hasProperty("duration")) endAt = startAt! + new ICAL.Event(component).duration.toSeconds() * 1000;
      const location = text(component, "location").slice(0, 160) || "San Francisco · venue not announced";
      const online = /^(?:online|virtual|https?:\/\/)/i.test(location);
      const bayArea = /oakland|berkeley|palo alto|san jose|mountain view|redwood city|san mateo|sunnyvale|menlo park|south san francisco/i.test(location);
      const opportunity = opportunitySchema.parse({ kind: "event", title, summary: details.slice(0, 240), description: details,
        sourceName: "Luma", sourceUrl: canonicalUrl, location, area: online ? "online" : bayArea ? "bay-area" : "sf",
        interests: /\bai\b|artificial intelligence/i.test(`${title} ${details}`) ? ["AI & machine learning"] : ["Other"],
        categories: [], organizerPick: false, status: "draft", cost: "unknown",
        ...(allDay ? { eventDate: date, ...(end instanceof ICAL.Time && end.isDate ? { eventEndDate: end.toString() } : {}) }
          : { startAt, ...(endAt !== undefined && endAt > startAt! ? { endAt } : {}) }),
      });
      if (records.length >= MAX_RECORDS) { skipped++; continue; }
      // TENTATIVE is an iCal event status, not a registration approval requirement.
      records.push({ sourceId: uid, canonicalUrl, opportunity, ...(cancelled ? { cancelled: true } : status === "CONFIRMED" ? { cancelled: false } : {}) });
    } catch { if (!cancelled) skipped++; }
  }
  return { records, cancellations, skipped };
}
