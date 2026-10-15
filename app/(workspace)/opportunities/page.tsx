import { OpportunitiesDashboard } from "@/components/opportunities-dashboard";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Opportunities",
  description: "Discover curated events, communities, and opportunities for your San Francisco chapter, and save the ones that fit your mission.",
  path: "/opportunities",
});

export const instant = false;
export default function OpportunitiesPage() { return <OpportunitiesDashboard />; }
