import { McpConsent } from "@/components/mcp-consent";
export const instant = false;
export default async function McpAuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <McpConsent input={await searchParams} />;
}
