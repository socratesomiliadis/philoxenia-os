export const lumaEvent = [
  "BEGIN:VEVENT", "UID:evt-builders@events.lu.ma", "DTSTART:20261020T010000Z", "DTEND:20261020T030000Z",
  "SUMMARY:AI builders meetup", "DESCRIPTION:Get up-to-date information at: https://lu.ma/builders?utm_source=test\\nMeet builders and share product feedback.",
  "SEQUENCE:1", "STATUS:TENTATIVE", "END:VEVENT",
].join("\r\n");
export function lumaCalendar(events = [lumaEvent]) { return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Luma//Test Calendar//EN", "METHOD:PUBLISH", ...events, "END:VCALENDAR"].join("\r\n"); }
