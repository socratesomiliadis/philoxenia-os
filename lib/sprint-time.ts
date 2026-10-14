import { eventTimeLabel, parseSfDateTime, sfCalendarDate, sfDateTimeInput } from "./opportunities";
import { SF_TIMEZONE } from "./cohort-dates";

const timeLabel = new Intl.DateTimeFormat("en-US", { timeZone: SF_TIMEZONE, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
export function sprintTimeRange(startAt: number, endAt: number) {
  return sfCalendarDate(startAt) === sfCalendarDate(endAt)
    ? `${timeLabel.format(startAt)} – ${timeLabel.format(endAt)}`
    : `${eventTimeLabel(startAt)} – ${eventTimeLabel(endAt)}`;
}

// SF repeats one hour when daylight saving ends. Preserve the chosen instant
// instead of round-tripping both occurrences to the library's default offset.
export function sfTimeCandidates(value: string): number[] {
  const base = parseSfDateTime(value);
  return [base - 3_600_000, base, base + 3_600_000].filter((timestamp) => sfDateTimeInput(timestamp) === value).sort((a, b) => a - b);
}
export function parseSprintTime(value: string, occurrence: string) {
  const choices = sfTimeCandidates(value);
  if (choices.length > 1 && !["first", "second"].includes(occurrence)) throw new Error("This SF time occurs twice when daylight saving ends. Choose the first or second occurrence.");
  return choices[occurrence === "second" ? choices.length - 1 : 0];
}
export function initialOccurrence(timestamp?: number) {
  if (timestamp === undefined) return "";
  const choices = sfTimeCandidates(sfDateTimeInput(timestamp));
  return choices.length > 1 && Math.floor(timestamp / 60_000) === Math.floor(choices[1] / 60_000) ? "second" : "first";
}
