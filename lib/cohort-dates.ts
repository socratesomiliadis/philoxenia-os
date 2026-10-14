import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";

export const SF_TIMEZONE = "America/Los_Angeles" as const;

export function sprintDates(startDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Choose a valid arrival date.");
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new TZDate(year, month - 1, day, SF_TIMEZONE);
  if (!Number.isFinite(start.getTime()) || format(start, "yyyy-MM-dd") !== startDate) {
    throw new Error("Choose a valid arrival date.");
  }
  return { startDate, endDate: format(addDays(start, 13), "yyyy-MM-dd") };
}

export function dateLabel(date: string, pattern = "MMM d, yyyy") {
  const [year, month, day] = date.split("-").map(Number);
  return format(new TZDate(year, month - 1, day, SF_TIMEZONE), pattern);
}

export function dateRangeLabel(startDate: string, endDate: string) {
  return `${dateLabel(startDate, "MMM d")} – ${dateLabel(endDate, "MMM d, yyyy")}`;
}
