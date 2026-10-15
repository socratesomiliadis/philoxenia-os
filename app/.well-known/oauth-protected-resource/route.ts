import { mcpOrigin, oauthOptions, oauthResponse } from "@/lib/mcp-http";
import { READ_SCOPE, WRITE_SCOPE } from "@/lib/mcp-policy";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const origin = mcpOrigin();
  return oauthResponse({ resource: `${origin}/api/mcp`, authorization_servers: [origin], scopes_supported: [READ_SCOPE, WRITE_SCOPE], bearer_methods_supported: ["header"], resource_name: "Philoxenia organizer workspace" });
}
export const OPTIONS = oauthOptions;
