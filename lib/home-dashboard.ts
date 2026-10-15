import { sfCalendarDate } from "./opportunities";
import { activityDate, inStay, sprintDays, type SprintData } from "./sprint";

export function homeSprintSummary(data: SprintData, now: number) {
  const today = sfCalendarDate(now);
  const entries = data.entries.filter((entry) => !entry.cancelledAt && inStay(entry, data.startDate, data.endDate));
  const upcoming = entries.filter((entry) => {
    const day = activityDate(entry);
    return entry.progress.status === "planned" && day && (entry.endAt !== undefined ? entry.endAt > now : day >= today);
  }).sort((a, b) => activityDate(a)!.localeCompare(activityDate(b)!) || (a.startAt ?? Infinity) - (b.startAt ?? Infinity) || a.title.localeCompare(b.title)).slice(0, 3);
  return {
    upcoming,
    planned: entries.filter((entry) => entry.progress.status === "planned").length,
    completed: entries.filter((entry) => entry.progress.status === "completed").length,
    outcomes: data.outcomes.reduce((sum, outcome) => sum + outcome.quantity, 0),
    flexible: entries.filter((entry) => entry.progress.status === "planned" && !activityDate(entry)).length,
  };
}

export function homeStayProgress(startDate: string, endDate: string, now: number) {
  const days = sprintDays(startDate, endDate);
  const today = sfCalendarDate(now);
  const dayIndex = days.indexOf(today);
  const daysUntil = Math.round((Date.parse(startDate) - Date.parse(today)) / 86_400_000);
  return { days, dayIndex, elapsed: today > endDate ? days.length : Math.max(0, dayIndex),
    label: today < startDate ? `${daysUntil} ${daysUntil === 1 ? "day" : "days"} until arrival` : today > endDate ? "Stay complete" : `Day ${dayIndex + 1} of ${days.length}` };
}
