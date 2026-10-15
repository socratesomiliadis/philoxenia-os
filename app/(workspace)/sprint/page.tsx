import { SprintDashboard } from "@/components/sprint-dashboard";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "14-day Sprint",
  description: "Plan your two weeks in San Francisco, schedule opportunities and shared activities, and track progress toward your personal mission.",
  path: "/sprint",
});

export const instant = false;
export default function SprintPage() { return <SprintDashboard />; }
