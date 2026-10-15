import { ConvexHttpClient } from "convex/browser";
import { canonicalMcpOrigin } from "./mcp-policy";

export function mcpBackend() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("MCP backend is not configured.");
  return new ConvexHttpClient(url);
}
export function mcpOrigin() {
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return canonicalMcpOrigin(site);
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("Set SITE_URL on the frontend to enable MCP.");
}
export function oauthError(error: unknown) {
  const codes = ["invalid_target", "invalid_client_metadata", "invalid_client", "invalid_scope", "unsupported_grant_type", "invalid_grant", "rate_limit_exceeded"];
  const message = error instanceof Error ? error.message : "";
  const code = codes.find((value) => message.includes(value)) ?? "invalid_request";
  return Response.json({ error: code }, { status: code === "rate_limit_exceeded" ? 429 : 400, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
export function oauthResponse(body: unknown) {
  return Response.json(body, { headers: { "Cache-Control": "no-store", Pragma: "no-cache", "Access-Control-Allow-Origin": "*" } });
}
export function oauthOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version", "Access-Control-Max-Age": "86400" } });
}
export async function readOAuthBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) throw new Error("Request too large.");
  const text = await request.text();
  if (text.length > 16_384) throw new Error("Request too large.");
  return request.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : Object.fromEntries(new URLSearchParams(text));
}
