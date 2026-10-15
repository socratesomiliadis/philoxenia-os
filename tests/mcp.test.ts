import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import schema from "../convex/schema";
import { api, components } from "../convex/_generated/api";
import { hashSecret, pkceChallenge, READ_SCOPE, WRITE_SCOPE } from "../lib/mcp-policy";
import { POST } from "../app/api/mcp/route";

const backendMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/mcp-http", async (original) => ({ ...await original<typeof import("../lib/mcp-http")>(), mcpBackend: backendMock }));
const modules = import.meta.glob("../convex/**/*.{ts,js}");
const resource = "https://philoxenia.example/api/mcp";
async function setup() {
  vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com,second@example.com");
  vi.stubEnv("SITE_URL", "https://philoxenia.example");
  const t = convexTest(schema, modules); betterAuthTest.register(t);
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email: "organizer@example.com", name: "Organizer", emailVerified: true, createdAt: now, updatedAt: now } } });
  const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: now + 3_600_000, createdAt: now, updatedAt: now } } });
  const organizer = t.withIdentity({ subject: user._id, sessionId: session._id });
  const profile = (await organizer.mutation(api.users.ensureProfile, {}))!;
  backendMock.mockReturnValue({ query: t.query.bind(t), mutation: t.mutation.bind(t) });
  return { t, organizer, profile };
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function personal(organizer: Awaited<ReturnType<typeof setup>>["organizer"], write = false) {
  return (await organizer.mutation(api.mcp.createPersonalToken, { name: "Test agent", scopes: write ? [READ_SCOPE, WRITE_SCOPE] : [READ_SCOPE], days: 30 })).token;
}
async function oauth(s: Awaited<ReturnType<typeof setup>>) {
  const client = await s.t.mutation(api.mcp.registerClient, { name: "Test OAuth client", redirectUris: ["http://127.0.0.1:12345/callback"] });
  const verifier = "a".repeat(43);
  const input = { client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", code_challenge_method: "S256", code_challenge: await pkceChallenge(verifier), state: "test-state", scope: `${READ_SCOPE} ${WRITE_SCOPE}`, resource };
  const redirect = new URL(await s.organizer.mutation(api.mcp.authorize, { input, accept: true }));
  expect(redirect.searchParams.get("state")).toBe("test-state");
  return { client, input, exchange: { grant_type: "authorization_code", client_id: client.client_id, resource, code: redirect.searchParams.get("code")!, redirect_uri: input.redirect_uri, code_verifier: verifier } };
}

describe("organizer MCP", () => {
  it("requires an organizer, hashes tokens, restricts scopes and never exposes secrets", async () => {
    const { t, organizer } = await setup();
    await expect(t.mutation(api.mcp.createPersonalToken, { name: "Untrusted", scopes: [READ_SCOPE], days: 30 })).rejects.toThrow();
    const token = await personal(organizer);
    const rows = await t.run((ctx) => ctx.db.query("mcpCredentials").collect());
    expect(rows[0].accessHash).toBe(await hashSecret(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(JSON.stringify(await organizer.query(api.mcp.connections, {}))).not.toContain(rows[0].accessHash);
    const info = await t.query(api.mcp.inspect, { token });
    expect(info.tools.some((tool) => tool.name === "list_users")).toBe(true);
    expect(info.tools.some((tool) => tool.name === "create_cohort")).toBe(false);
    await expect(t.mutation(api.mcp.callTool, { token, name: "create_cohort", arguments: {} })).rejects.toThrow("unavailable");
    await expect(organizer.mutation(api.mcp.createPersonalToken, { name: "Bad scopes", scopes: [READ_SCOPE, "admin"], days: 30 })).rejects.toThrow();
  });
  it("reuses organizer mutations, rejects unknown tools, extra arguments and wrong-table IDs", async () => {
    const { t, organizer } = await setup(), token = await personal(organizer, true);
    const call = (name: string, args: object) => t.mutation(api.mcp.callTool, { token, name, arguments: args });
    const cohortId = await call("create_cohort", { name: "Agent cohort", description: "", startDate: "2026-11-02" });
    await call("invite_user", { cohortId, email: "hustler@example.com", name: "Hustler" });
    const cohorts = await organizer.query(api.cohorts.list, {});
    expect(cohorts).toHaveLength(1);
    expect(await organizer.query(api.cohorts.roster, { cohortId: cohorts[0]._id })).toMatchObject({ invitations: [{ email: "hustler@example.com" }] });
    await expect(call("set_user_suspended", { profileId: cohortId, suspended: true })).rejects.toThrow("Invalid arguments.profileId");
    await expect(call("list_cohorts", { unexpected: true })).rejects.toThrow("Invalid arguments");
    await expect(call("delete_user", {})).rejects.toThrow("unavailable");
    expect((await organizer.query(api.mcp.connections, {})).audit.map((row) => row.tool)).toContain("invite_user");
  });
  it("preserves opportunity revisions and shared activity cancellation", async () => {
    const { t, organizer } = await setup(), token = await personal(organizer, true);
    const call = (name: string, args: object) => t.mutation(api.mcp.callTool, { token, name, arguments: args });
    const cohortId = await organizer.mutation(api.cohorts.create, { name: "Sprint cohort", description: "", startDate: "2026-11-02" });
    const opportunity = { kind: "startup", title: "Example startup", summary: "A startup directory listing", description: "Review this public startup directory listing for opportunities.", interests: ["Developer tools"], categories: ["learn"], area: "online", location: "Online", sourceName: "Example", sourceUrl: "https://example.com/startup", organizerPick: false, status: "draft" };
    await call("save_opportunity", { opportunity });
    const list = await organizer.query(api.opportunities.list, { management: true });
    await expect(call("save_opportunity", { opportunityId: list.entries[0]._id, expectedUpdatedAt: 0, opportunity })).rejects.toThrow("Another organizer changed");
    const activityId = await call("save_activity", { cohortId, expectedRevision: 0, input: { kind: "task", title: "Meet the cohort", notes: "", location: "SF", day: "2026-11-03" } });
    await call("cancel_activity", { activityId, expectedRevision: 1 });
    expect((await organizer.query(api.sprint.shared, { cohortId })).entries[0].cancelledAt).toBeDefined();
    await call("restore_activity", { activityId, expectedRevision: 2 });
  });
  it("rejects expired, revoked, suspended and de-authorized credentials", async () => {
    const { t, organizer, profile } = await setup(), token = await personal(organizer);
    const row = (await t.run((ctx) => ctx.db.query("mcpCredentials").collect()))[0];
    await t.run((ctx) => ctx.db.patch(row._id, { expiresAt: Date.now() - 1 }));
    await expect(t.query(api.mcp.inspect, { token })).rejects.toThrow("invalid_token");
    await t.run((ctx) => ctx.db.patch(row._id, { expiresAt: Date.now() + 60_000 }));
    vi.stubEnv("ORGANIZER_EMAILS", "second@example.com");
    await expect(t.query(api.mcp.inspect, { token })).rejects.toThrow("invalid_token");
    vi.stubEnv("ORGANIZER_EMAILS", "organizer@example.com");
    await t.run((ctx) => ctx.db.patch(profile._id, { suspended: true }));
    await expect(t.query(api.mcp.inspect, { token })).rejects.toThrow("invalid_token");
    await t.run((ctx) => ctx.db.patch(profile._id, { suspended: false }));
    await organizer.mutation(api.mcp.revokeConnection, { credentialId: row._id });
    await expect(t.mutation(api.mcp.callTool, { token, name: "list_cohorts", arguments: {} })).rejects.toThrow("invalid_token");
  });
  it("binds OAuth codes to client, resource, redirect and PKCE, and consumes them once", async () => {
    const s = await setup(), { exchange } = await oauth(s);
    for (const override of [{ resource: "https://attacker.example/api/mcp" }, { redirect_uri: "https://attacker.example/callback" }, { code_verifier: "b".repeat(43) }, { client_id: "wrong" }]) {
      await expect(s.t.mutation(api.mcp.exchangeToken, { input: { ...exchange, ...override } })).rejects.toThrow();
    }
    const tokens = await s.t.mutation(api.mcp.exchangeToken, { input: exchange });
    expect((await s.t.query(api.mcp.inspect, { token: tokens.access_token })).scopes).toContain(WRITE_SCOPE);
    await expect(s.t.mutation(api.mcp.exchangeToken, { input: exchange })).rejects.toThrow("invalid_grant");
    expect(JSON.stringify(await s.t.run((ctx) => ctx.db.query("mcpCredentials").collect()))).not.toContain(tokens.refresh_token);
  });
  it("rotates refresh tokens, prevents scope escalation, revokes the entire connection", async () => {
    const s = await setup(), { exchange, client } = await oauth(s);
    const tokens = await s.t.mutation(api.mcp.exchangeToken, { input: exchange });
    const refresh = { grant_type: "refresh_token", client_id: client.client_id, resource, refresh_token: tokens.refresh_token };
    await expect(s.t.mutation(api.mcp.exchangeToken, { input: { ...refresh, scope: `${READ_SCOPE} admin` } })).rejects.toThrow();
    const next = await s.t.mutation(api.mcp.exchangeToken, { input: { ...refresh, scope: READ_SCOPE } });
    await expect(s.t.mutation(api.mcp.exchangeToken, { input: refresh })).rejects.toThrow("invalid_grant");
    await expect(s.t.query(api.mcp.inspect, { token: tokens.access_token })).rejects.toThrow("invalid_token");
    await s.t.mutation(api.mcp.revokeToken, { token: next.refresh_token, clientId: client.client_id });
    await expect(s.t.query(api.mcp.inspect, { token: next.access_token })).rejects.toThrow("invalid_token");
    await expect(s.t.mutation(api.mcp.exchangeToken, { input: { ...refresh, refresh_token: next.refresh_token } })).rejects.toThrow("invalid_grant");
  });
  it("validates registrations and denial, rejects expired codes", async () => {
    const s = await setup(), { input, exchange } = await oauth(s);
    await expect(s.t.mutation(api.mcp.registerClient, { name: "Unsafe", redirectUris: ["https://example.com/#fragment"] })).rejects.toThrow();
    await expect(s.t.mutation(api.mcp.registerClient, { name: "Unsafe", redirectUris: ["http://attacker.example/callback"] })).rejects.toThrow();
    const denied = new URL(await s.organizer.mutation(api.mcp.authorize, { input, accept: false }));
    expect(denied.searchParams.get("error")).toBe("access_denied");
    expect(denied.searchParams.get("code")).toBeNull();
    const code = (await s.t.run((ctx) => ctx.db.query("mcpCodes").collect()))[0];
    await s.t.run((ctx) => ctx.db.patch(code._id, { expiresAt: Date.now() - 1 }));
    await expect(s.t.mutation(api.mcp.exchangeToken, { input: exchange })).rejects.toThrow("invalid_grant");
  });
  it("supports a real SDK client through HTTP and returns OAuth discovery challenges", async () => {
    const s = await setup(), token = await personal(s.organizer, true);
    expect((await POST(new Request(resource, { method: "POST" }))).headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource/api/mcp");
    expect((await POST(new Request(resource, { method: "POST", headers: { Origin: "https://attacker.example" } }))).status).toBe(403);
    const client = new Client({ name: "integration-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: `Bearer ${token}` } }, fetch: async (url, init) => POST(new Request(url, init)) });
    try {
      await client.connect(transport);
      expect((await client.listTools()).tools.some((tool) => tool.name === "list_users")).toBe(true);
      expect((await client.callTool({ name: "create_cohort", arguments: { name: "SDK cohort", description: "", startDate: "2026-11-02" } })).isError).not.toBe(true);
      expect(JSON.stringify((await client.callTool({ name: "list_cohorts", arguments: {} })).content)).toContain("SDK cohort");
    } finally { await client.close(); }
  });
});
