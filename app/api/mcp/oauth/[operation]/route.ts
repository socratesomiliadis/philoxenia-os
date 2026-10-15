import { api } from "@/convex/_generated/api";
import { mcpBackend, oauthError, oauthOptions, oauthResponse, readOAuthBody } from "@/lib/mcp-http";

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  try {
    const body = await readOAuthBody(request), backend = mcpBackend();
    if (operation === "register") {
      if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") throw new Error("invalid_client_metadata");
      if (body.grant_types?.some((grant: string) => !["authorization_code", "refresh_token"].includes(grant)) || body.response_types?.some((type: string) => type !== "code")) throw new Error("invalid_client_metadata");
      const result = await backend.mutation(api.mcp.registerClient, { name: body.client_name ?? "MCP agent", redirectUris: body.redirect_uris });
      const response = oauthResponse(result);
      return new Response(response.body, { status: 201, headers: response.headers });
    }
    if (operation === "token") return oauthResponse(await backend.mutation(api.mcp.exchangeToken, { input: body }));
    if (operation === "revoke") {
      if (typeof body.token !== "string" || typeof body.client_id !== "string") throw new Error("invalid_request");
      await backend.mutation(api.mcp.revokeToken, { token: body.token, clientId: body.client_id });
      return oauthResponse({});
    }
    return new Response(null, { status: 404 });
  } catch (error) { return oauthError(error); }
}
export const OPTIONS = oauthOptions;
