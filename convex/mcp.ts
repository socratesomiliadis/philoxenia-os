import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { isOrganizerEmail, requireOrganizer } from "./access";
import { withMcpIdentity } from "./mcpIdentity";
import { mcpTools } from "./mcpTools";
import { authorizationSchema, canonicalMcpOrigin, hashSecret, parseScopes, pkceChallenge, randomSecret, READ_SCOPE, safeRedirectUri, WRITE_SCOPE } from "../lib/mcp-policy";

const HOUR = 3_600_000, DAY = 24 * HOUR;
const scopes = v.array(v.string());
type Ctx = QueryCtx | MutationCtx;
function resourceUrl() {
  if (!process.env.SITE_URL) throw new ConvexError("Configure SITE_URL before enabling MCP.");
  return new URL("/api/mcp", canonicalMcpOrigin(process.env.SITE_URL)).href;
}
function checkResource(resource: string) {
  if (resource !== resourceUrl()) throw new ConvexError("invalid_target");
}
async function currentOrganizer(ctx: Ctx, profileId: Id<"profiles">) {
  const profile = await ctx.db.get(profileId);
  const user = profile ? await authComponent.getAnyUserById(ctx, profile.authUserId) : null;
  if (!profile || profile.suspended || !user?.emailVerified || !isOrganizerEmail(user.email)) throw new ConvexError("invalid_token");
  return profile;
}
async function credential(ctx: Ctx, token: string) {
  if (!/^phx_(pat|access)_[a-f0-9]{64}$/.test(token)) throw new ConvexError("invalid_token");
  // Hash before the lookup; plaintext credentials are never persisted.
  const hash = await hashSecret(token);
  const found = await ctx.db.query("mcpCredentials").withIndex("by_access", (q) => q.eq("accessHash", hash)).unique();
  if (!found || found.revokedAt !== undefined || found.expiresAt <= Date.now() || found.resource !== resourceUrl()) throw new ConvexError("invalid_token");
  const profile = await currentOrganizer(ctx, found.profileId);
  return { credential: found, profile };
}
async function limit(ctx: MutationCtx, key: string, max: number) {
  const now = Date.now(), row = await ctx.db.query("mcpRateLimits").withIndex("by_key", (q) => q.eq("key", key)).unique();
  if (!row) { await ctx.db.insert("mcpRateLimits", { key, start: now, count: 1 }); return; }
  const count = now - row.start >= 60_000 ? 1 : row.count + 1;
  if (count > max) throw new ConvexError("rate_limit_exceeded");
  await ctx.db.patch(row._id, { start: count === 1 ? now : row.start, count });
}
async function newOauthTokens(ctx: MutationCtx, input: { profileId: Id<"profiles">; name: string; clientId: string; resource: string; scopes: string[] }, existing?: Doc<"mcpCredentials">) {
  const access = randomSecret("phx_access_"), refresh = randomSecret("phx_refresh_");
  const now = Date.now();
  const data = { ...input, kind: "oauth" as const, accessHash: await hashSecret(access), refreshHash: await hashSecret(refresh),
    expiresAt: now + HOUR, refreshExpiresAt: existing?.refreshExpiresAt ?? now + 30 * DAY };
  if (existing) await ctx.db.patch(existing._id, data); else await ctx.db.insert("mcpCredentials", data);
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 3600, scope: input.scopes.join(" ") };
}

export const connections = query({ args: {}, handler: async (ctx) => {
  const { profile } = await requireOrganizer(ctx);
  const rows = await ctx.db.query("mcpCredentials").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).collect();
  return { resource: resourceUrl(), connections: rows.map(({ _id, name, kind, scopes, expiresAt, refreshExpiresAt, revokedAt, lastUsedAt }) => ({ _id, name, kind, scopes, expiresAt, refreshExpiresAt, revokedAt, lastUsedAt })),
    audit: await ctx.db.query("mcpAudit").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).order("desc").take(25) };
} });
export const createPersonalToken = mutation({ args: { name: v.string(), scopes, days: v.number() }, handler: async (ctx, args) => {
  const { profile } = await requireOrganizer(ctx);
  const allowed = parseScopes(args.scopes.join(" "));
  if (!args.name.trim() || args.name.length > 80 || !Number.isInteger(args.days) || args.days < 1 || args.days > 90) throw new ConvexError("Use a name and an expiry of 1–90 days.");
  await limit(ctx, `create:${profile._id}`, 10);
  const token = randomSecret("phx_pat_");
  await ctx.db.insert("mcpCredentials", { profileId: profile._id, name: args.name.trim(), kind: "personal", accessHash: await hashSecret(token), resource: resourceUrl(), scopes: allowed, expiresAt: Date.now() + args.days * DAY });
  return { token };
} });
export const revokeConnection = mutation({ args: { credentialId: v.id("mcpCredentials") }, handler: async (ctx, { credentialId }) => {
  const { profile } = await requireOrganizer(ctx), row = await ctx.db.get(credentialId);
  if (!row || row.profileId !== profile._id) throw new ConvexError("Connection unavailable.");
  await ctx.db.patch(row._id, { revokedAt: Date.now() });
} });
export const inspect = query({ args: { token: v.string() }, handler: async (ctx, { token }) => {
  const { credential: row } = await credential(ctx, token);
  return { scopes: row.scopes, tools: mcpTools.filter((tool) => row.scopes.includes(tool.scope)).map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })) };
} });
export const callTool = mutation({ args: { token: v.string(), name: v.string(), arguments: v.any() }, handler: async (ctx, args): Promise<unknown> => {
  const { credential: row, profile } = await credential(ctx, args.token);
  const tool = mcpTools.find((entry) => entry.name === args.name);
  if (!tool || !row.scopes.includes(tool.scope)) throw new ConvexError("This tool is unavailable for this connection.");
  if (JSON.stringify(args.arguments).length > 64_000) throw new ConvexError("Tool arguments are too large.");
  const now = Date.now(), fresh = now - (row.windowStart ?? 0) >= 60_000;
  if (!fresh && (row.windowCalls ?? 0) >= 60) throw new ConvexError("rate_limit_exceeded");
  const result = await withMcpIdentity(ctx, profile, () => tool.run(ctx, args.arguments));
  await ctx.db.patch(row._id, { lastUsedAt: now, windowStart: fresh ? now : row.windowStart, windowCalls: fresh ? 1 : (row.windowCalls ?? 0) + 1 });
  await ctx.db.insert("mcpAudit", { profileId: profile._id, credentialId: row._id, tool: tool.name, at: now });
  return result;
} });

export const registerClient = mutation({ args: { name: v.string(), redirectUris: v.array(v.string()) }, handler: async (ctx, args) => {
  if (!args.name.trim() || args.name.length > 100 || args.redirectUris.length < 1 || args.redirectUris.length > 10) throw new ConvexError("invalid_client_metadata");
  args.redirectUris.forEach(safeRedirectUri);
  await limit(ctx, "register", 20);
  const clientId = randomSecret("phx_client_");
  await ctx.db.insert("mcpClients", { clientId, name: args.name.trim(), redirectUris: args.redirectUris });
  return { client_id: clientId, client_name: args.name.trim(), redirect_uris: args.redirectUris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] };
} });
async function authorization(ctx: Ctx, input: unknown) {
  const args = authorizationSchema.parse(input);
  checkResource(args.resource);
  const allowed = parseScopes(args.scope);
  const client = await ctx.db.query("mcpClients").withIndex("by_client", (q) => q.eq("clientId", args.client_id)).unique();
  if (!client || !client.redirectUris.includes(args.redirect_uri)) throw new ConvexError("invalid_client");
  return { args, client, allowed };
}
export const consentDetails = query({ args: { input: v.any() }, handler: async (ctx, { input }) => {
  await requireOrganizer(ctx);
  try {
    const { client, allowed } = await authorization(ctx, input);
    return { valid: true as const, name: client.name, scopes: allowed };
  } catch { return { valid: false as const }; }
} });
export const authorize = mutation({ args: { input: v.any(), accept: v.boolean() }, handler: async (ctx, { input, accept }) => {
  const { profile } = await requireOrganizer(ctx);
  const { args, client, allowed } = await authorization(ctx, input);
  await limit(ctx, `authorize:${profile._id}`, 20);
  const redirect = new URL(args.redirect_uri);
  if (args.state !== undefined) redirect.searchParams.set("state", args.state);
  if (!accept) { redirect.searchParams.set("error", "access_denied"); return redirect.href; }
  const code = randomSecret("phx_code_");
  await ctx.db.insert("mcpCodes", { hash: await hashSecret(code), profileId: profile._id, clientId: client.clientId,
    redirectUri: args.redirect_uri, challenge: args.code_challenge, resource: args.resource, scopes: allowed, expiresAt: Date.now() + 5 * 60_000 });
  redirect.searchParams.set("code", code);
  return redirect.href;
} });
export const exchangeToken = mutation({ args: { input: v.any() }, handler: async (ctx, { input }): Promise<{ access_token: string; refresh_token: string; token_type: string; expires_in: number; scope: string }> => {
  if (!input || typeof input !== "object") throw new ConvexError("invalid_request");
  const { grant_type, client_id, resource } = input;
  if (typeof client_id !== "string" || typeof resource !== "string") throw new ConvexError("invalid_request");
  checkResource(resource);
  const client = await ctx.db.query("mcpClients").withIndex("by_client", (q) => q.eq("clientId", client_id)).unique();
  if (!client) throw new ConvexError("invalid_client");
  if (grant_type === "authorization_code") {
    if (typeof input.code !== "string" || typeof input.code_verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.code_verifier)) throw new ConvexError("invalid_grant");
    const hash = await hashSecret(input.code), code = await ctx.db.query("mcpCodes").withIndex("by_hash", (q) => q.eq("hash", hash)).unique();
    if (!code || code.expiresAt <= Date.now() || code.clientId !== client_id || code.redirectUri !== input.redirect_uri || code.resource !== resource || code.challenge !== await pkceChallenge(input.code_verifier)) throw new ConvexError("invalid_grant");
    await currentOrganizer(ctx, code.profileId);
    const tokens = await newOauthTokens(ctx, { profileId: code.profileId, name: client.name, clientId: client_id, resource, scopes: code.scopes });
    await ctx.db.delete(code._id);
    return tokens;
  }
  if (grant_type === "refresh_token") {
    if (typeof input.refresh_token !== "string") throw new ConvexError("invalid_grant");
    const hash = await hashSecret(input.refresh_token), row = await ctx.db.query("mcpCredentials").withIndex("by_refresh", (q) => q.eq("refreshHash", hash)).unique();
    if (!row || row.revokedAt !== undefined || row.clientId !== client_id || row.resource !== resource || (row.refreshExpiresAt ?? 0) <= Date.now()) throw new ConvexError("invalid_grant");
    await currentOrganizer(ctx, row.profileId);
    const allowed = input.scope === undefined ? row.scopes : parseScopes(input.scope);
    if (allowed.some((scope) => !row.scopes.includes(scope))) throw new ConvexError("invalid_scope");
    return newOauthTokens(ctx, { profileId: row.profileId, name: row.name, clientId: client_id, resource, scopes: allowed }, row);
  }
  throw new ConvexError("unsupported_grant_type");
} });
export const revokeToken = mutation({ args: { token: v.string(), clientId: v.string() }, handler: async (ctx, args) => {
  const hash = await hashSecret(args.token);
  const access = await ctx.db.query("mcpCredentials").withIndex("by_access", (q) => q.eq("accessHash", hash)).unique();
  const row = access ?? await ctx.db.query("mcpCredentials").withIndex("by_refresh", (q) => q.eq("refreshHash", hash)).unique();
  if (row?.clientId === args.clientId) await ctx.db.patch(row._id, { revokedAt: Date.now() });
} });

export { READ_SCOPE, WRITE_SCOPE };
