import type { SprintEntry } from "./sprint";

// RFC 5545: UTC VEVENTs preserve SF instants across DST. Untimed work is VTODO.
// https://www.rfc-editor.org/rfc/rfc5545
const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const utc = (timestamp: number) => new Date(timestamp).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export function foldCalendarLine(line: string) {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = "", bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { lines.push(current); current = " "; bytes = 1; }
    current += character; bytes += size;
  }
  lines.push(current);
  return lines.join("\r\n");
}

export function sprintCalendar(entries: SprintEntry[], name = "Philoxenia Sprint") {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Philoxenia//14-day Sprint//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeText(name)}`];
  for (const entry of entries) {
    if (entry.cancelledAt || entry.progress.status === "skipped") continue;
    const timed = entry.startAt !== undefined && entry.endAt !== undefined;
    const component = timed ? "VEVENT" : "VTODO";
    const modified = Math.max(entry.updatedAt, entry.progress.updatedAt);
    lines.push(`BEGIN:${component}`, `UID:${escapeText(entry.calendarUid)}`, `DTSTAMP:${utc(modified)}`, `LAST-MODIFIED:${utc(modified)}`, `SEQUENCE:${entry.revision + entry.progress.revision}`, `SUMMARY:${escapeText(entry.title)}`);
    if (timed) lines.push(`DTSTART:${utc(entry.startAt!)}`, `DTEND:${utc(entry.endAt!)}`, "STATUS:CONFIRMED");
    else {
      if (entry.day) lines.push(`DUE;VALUE=DATE:${entry.day.replace(/-/g, "")}`);
      lines.push(`STATUS:${entry.progress.status === "completed" ? "COMPLETED" : "NEEDS-ACTION"}`);
      if (entry.progress.completedAt && entry.progress.status === "completed") lines.push(`COMPLETED:${utc(entry.progress.completedAt)}`);
    }
    if (entry.notes) lines.push(`DESCRIPTION:${escapeText(entry.notes)}`);
    if (entry.location) lines.push(`LOCATION:${escapeText(entry.location)}`);
    if (entry.sourceUrl) lines.push(`URL:${entry.sourceUrl.replace(/[\r\n]/g, "")}`);
    lines.push(`END:${component}`);
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}

export function downloadSprint(entries: SprintEntry[], name: string) {
  const url = URL.createObjectURL(new Blob([sprintCalendar(entries, name)], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "philoxenia-sprint.ics";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
