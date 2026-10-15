import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-session";

const profile = { _id: "organizer-profile", _creationTime: 1, authUserId: "organizer-user", name: "Organizer", email: "organizer@example.com", isAlumni: false, suspended: false };
function baseQuery(path: string) {
  switch (path) {
    case "auth:readiness": return { google: true, emailAndPassword: true };
    case "users:viewer": return { name: profile.name, email: profile.email, profile, isOrganizer: true, participantCohortIds: [], allowed: true, needsProvisioning: false };
    case "cohorts:list": case "notifications:inbox": case "notifications:deliveries": return [];
    case "onboarding:required": case "commandCenter:operations": return null;
    default: throw new Error(`Unexpected query: ${path}`);
  }
}

test("organiser can create a token once and revoke its connection at mobile width", async ({ page }) => {
  let connection: Record<string, unknown> | null = null;
  const mutations: { path: string; args: Record<string, unknown> }[] = [];
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path) {
      return path === "mcp:connections" ? { resource: "http://localhost:3000/api/mcp", connections: connection ? [connection] : [], audit: [] } : baseQuery(path);
    },
    mutate(path, args) {
      mutations.push({ path, args });
      if (path === "mcp:createPersonalToken") {
        connection = { _id: "test-connection", name: args.name, kind: "personal", scopes: args.scopes, expiresAt: Date.now() + 86_400_000 };
        return { token: "phx_pat_test-token-shown-once" };
      }
      if (path === "mcp:revokeConnection") { connection = { ...connection, revokedAt: Date.now() }; return null; }
      throw new Error(`Unexpected mutation: ${path}`);
    },
  });
  await page.goto("/organizer#settings");
  await expect(page.getByRole("heading", { name: "Connect your agent", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mcp-settings-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.getByRole("textbox", { name: "Agent name", exact: true }).fill("My Codex");
  await page.getByRole("button", { name: "Create token", exact: true }).click();
  await expect(page.getByText("Copy your token now. It is shown only once.", { exact: true })).toBeVisible();
  expect(mutations[0]).toEqual({ path: "mcp:createPersonalToken", args: { name: "My Codex", days: 30, scopes: ["organizer:read"] } });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("phx_pat_test-token-shown-once", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke access", exact: true }).click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mcp-settings-mobile.png", fullPage: true });
});

test("OAuth consent identifies the client and requested write access before allowing it", async ({ page }) => {
  let approved: Record<string, unknown> | null = null;
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path) { return path === "mcp:consentDetails" ? { valid: true, name: "My preferred agent", scopes: ["organizer:read", "organizer:write"] } : baseQuery(path); },
    mutate(path, args) {
      if (path !== "mcp:authorize") throw new Error(`Unexpected mutation: ${path}`);
      approved = args;
      return "/mcp-test-callback?code=test";
    },
  });
  await page.route("**/mcp-test-callback?**", (route) => route.fulfill({ contentType: "text/html", body: "Connection authorised" }));
  await page.goto("/mcp/authorize?client_id=test-client&resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmcp");
  await expect(page.getByRole("heading", { name: "Connect My preferred agent to Philoxenia?", exact: true })).toBeVisible();
  await expect(page.getByText(/Invite users, change participant access/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 950 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mcp-consent-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Allow access", exact: true }).click();
  await expect(page).toHaveURL(/mcp-test-callback/);
  expect(approved).toMatchObject({ accept: true, input: { client_id: "test-client" } });
});

test("MCP endpoint challenges unauthenticated clients and exposes discovery", async ({ request }) => {
  const challenge = await request.post("/api/mcp", { data: { jsonrpc: "2.0", id: 1, method: "initialize" } });
  expect(challenge.status()).toBe(401);
  expect(challenge.headers()["www-authenticate"]).toContain("/.well-known/oauth-protected-resource/api/mcp");
  const resource = await request.get("/.well-known/oauth-protected-resource/api/mcp");
  expect(await resource.json()).toMatchObject({ resource: expect.stringContaining("/api/mcp"), scopes_supported: ["organizer:read", "organizer:write"] });
  const authorization = await request.get("/.well-known/oauth-authorization-server");
  expect(await authorization.json()).toMatchObject({ code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"] });
});

test("Google and email verification keep the pending OAuth consent destination", async ({ page }) => {
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path) {
      if (path === "auth:readiness") return { google: true, emailAndPassword: true };
      if (path === "users:viewer") return null;
      throw new Error(`Unexpected query: ${path}`);
    },
    mutate() { throw new Error("Unexpected mutation"); },
  });
  const requests: Record<string, string>[] = [];
  await page.route("**/api/auth/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/get-session")) return route.fulfill({ json: null });
    if (route.request().method() !== "POST") return route.fallback();
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { status: true, token: null } });
  });
  const destination = "/mcp/authorize?client_id=pending-agent&state=original-state";
  await page.goto(destination);
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].callbackURL).toBe(destination);
  // A new page visit clears the sign-in button's busy state after the mocked redirect.
  await page.goto(destination);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Full name").fill("Organizer");
  await page.getByLabel("Email address", { exact: true }).fill("organizer@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].callbackURL).toBe(destination);
});
