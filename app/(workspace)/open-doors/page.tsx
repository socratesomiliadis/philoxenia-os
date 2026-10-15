import { OpenDoors } from "@/components/open-doors";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Open Doors",
  description: "Find support, introductions, and guidance from the Philoxenia alumni community to help move your San Francisco mission forward.",
  path: "/open-doors",
});

export const instant = false;
export default function OpenDoorsPage() { return <OpenDoors />; }
