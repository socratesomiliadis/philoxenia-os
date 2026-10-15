import { OrganizerDashboard } from "@/components/organizer-dashboard";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Command Center",
  description: "Coordinate Philoxenia cohorts, support participants, and manage opportunities and community activity in one workspace.",
  path: "/organizer",
});

export const instant = false;
export default function OrganizerPage() { return <OrganizerDashboard />; }
