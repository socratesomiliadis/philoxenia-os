import { mcpOrigin, oauthOptions, oauthResponse } from "@/lib/mcp-http";
import { READ_SCOPE, WRITE_SCOPE } from "@/lib/mcp-policy";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const origin = mcpOrigin();
  return oauthResponse({ issuer: origin, authorization_endpoint: `${origin}/mcp/authorize`, token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`, revocation_endpoint: `${origin}/api/mcp/oauth/revoke`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"], scopes_supported: [READ_SCOPE, WRITE_SCOPE] });
}
export const OPTIONS = oauthOptions;
