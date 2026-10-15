import { CommunityPage } from "@/components/community";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Community",
  description: "Connect with fellow Hustlers and Philoxenia alumni, discover shared interests, and build relationships in San Francisco.",
  path: "/community",
});

export const instant = false;
export default function Page() { return <CommunityPage />; }
