import { McpConsent } from "@/components/mcp-consent";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Connect your agent",
  description: "Review and authorize an agent connection to your Philoxenia OS organizer workspace.",
  path: "/mcp/authorize",
});

export const instant = false;
export default async function McpAuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <McpConsent input={await searchParams} />;
}
