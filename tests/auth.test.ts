import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, components } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

function setup() {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-auth-secret-at-least-32-characters");
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  vi.stubEnv("RESEND_API_KEY", "test-resend-key");
  vi.stubEnv("EMAIL_FROM", "Philoxenia <auth@example.com>");
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  const emails: { to: string[]; text: string; subject: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    emails.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ id: "test-email" }), { status: 200 });
  }));
  const post = (path: string, body: object) => t.fetch(`/api/auth/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body),
  });
  return { t, emails, post };
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("email and password authentication", () => {
  it("reports email readiness independently of Google and requires mail configuration", async () => {
    const { t } = setup();
    expect(await t.query(api.auth.readiness, {})).toEqual({ google: false, emailAndPassword: true });
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await t.query(api.auth.readiness, {})).toEqual({ google: false, emailAndPassword: false });
  });

  it("hashes passwords and blocks unverified sign-in and organizer provisioning", async () => {
    const { t, emails, post } = setup();
    vi.stubEnv("ORGANIZER_EMAILS", "invited@example.com");
    const signup = await post("sign-up/email", { name: "Invited Hustler", email: "invited@example.com", password: "test-password-123", callbackURL: "/sign-in" });
    expect(signup.status).toBe(200);
    expect((await signup.json()).token).toBeNull();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toEqual(["invited@example.com"]);
    expect(emails[0].text).toContain("/api/auth/verify-email?token=");
    const user = await t.query(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "email", value: "invited@example.com" }] });
    expect(user?.emailVerified).toBe(false);
    const account = await t.query(components.betterAuth.adapter.findOne, { model: "account", where: [{ field: "userId", value: user!._id }] });
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe("test-password-123");
    const signin = await post("sign-in/email", { email: "invited@example.com", password: "test-password-123", callbackURL: "/sign-in" });
    expect(signin.status).toBe(403);
    expect((await signin.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(emails).toHaveLength(2);
    const now = Date.now();
    const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user!._id, token: "test-session", expiresAt: now + 60_000, createdAt: now, updatedAt: now } } });
    const unverified = t.withIdentity({ subject: user!._id, sessionId: session._id });
    expect((await unverified.query(api.users.viewer, {}))?.allowed).toBe(false);
    await expect(unverified.mutation(api.users.ensureProfile, {})).rejects.toThrow("verified email");
    const verificationURL = new URL(emails[0].text.match(/https?:\/\/\S+/)![0]);
    const verified = await t.fetch(`${verificationURL.pathname}${verificationURL.search}`);
    expect(verified.status).toBe(302);
    expect((await t.query(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "_id", value: user!._id }] }))?.emailVerified).toBe(true);
    expect((await post("sign-in/email", { email: user!.email, password: "incorrect-password" })).status).toBe(401);
    expect((await post("sign-in/email", { email: user!.email, password: "test-password-123" })).status).toBe(200);
  });

  it("lets existing Google users set a password on the same account and consumes reset links once", async () => {
    const { t, emails, post } = setup();
    const now = Date.now();
    const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { email: "google@example.com", name: "Google Hustler", emailVerified: true, createdAt: now, updatedAt: now } } });
    await t.mutation(components.betterAuth.adapter.create, { input: { model: "account", data: { userId: user._id, providerId: "google", accountId: "google-id", createdAt: now, updatedAt: now } } });
    await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: "old-session", expiresAt: now + 60_000, createdAt: now, updatedAt: now } } });
    const request = await post("request-password-reset", { email: user.email, redirectTo: "/sign-in?reset=true" });
    expect(request.status).toBe(200);
    const link = emails[0].text.match(/https?:\/\/\S+/)![0];
    const token = new URL(link).pathname.split("/").at(-1)!;
    const reset = await post("reset-password", { token, newPassword: "new-password-123" });
    expect(reset.status).toBe(200);
    const credential = await t.query(components.betterAuth.adapter.findOne, { model: "account", where: [{ field: "userId", value: user._id }, { field: "providerId", value: "credential" }] });
    expect(credential?.userId).toBe(user._id);
    expect(credential?.password).not.toBe("new-password-123");
    expect(await t.query(components.betterAuth.adapter.findOne, { model: "session", where: [{ field: "userId", value: user._id }] })).toBeNull();
    expect((await post("reset-password", { token, newPassword: "another-password" })).status).toBe(400);
    expect((await post("request-password-reset", { email: "missing@example.com", redirectTo: "/sign-in?reset=true" })).status).toBe(200);
    expect(emails).toHaveLength(1);
  });
});
