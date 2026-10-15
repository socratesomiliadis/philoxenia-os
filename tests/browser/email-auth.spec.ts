import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-session";

test("email-only sign-up validates passwords, resends verification, and offers password recovery on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSession(page, {
    user: { id: "test-user", name: "Test Hustler", email: "test@example.com" },
    query: (path) => {
      if (path === "auth:readiness") return { google: false, emailAndPassword: true };
      if (path === "users:viewer") return null;
      throw new Error(`Unexpected query: ${path}`);
    },
    mutate: () => { throw new Error("Unexpected mutation"); },
  });
  const requests: { path: string; body: Record<string, string> }[] = [];
  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/get-session")) return route.fulfill({ json: null });
    if (route.request().method() !== "POST") return route.fallback();
    requests.push({ path, body: route.request().postDataJSON() });
    if (path.endsWith("/sign-in/email")) return route.fulfill({ status: 403, json: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" } });
    return route.fulfill({ json: { status: true, token: null } });
  });
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Google sign-in is not connected yet" })).toBeDisabled();
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Full name").fill("Test Hustler");
  await page.getByLabel("Email address", { exact: true }).fill("TEST@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("mismatched-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("region", { name: "Sign in", exact: true }).getByRole("alert")).toContainText("Your passwords do not match");
  expect(requests).toHaveLength(0);
  await page.getByLabel("Confirm password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  expect(requests[0]).toEqual({ path: "/api/auth/sign-up/email", body: { name: "Test Hustler", email: "test@example.com", password: "test-password-123", callbackURL: "/sign-in" } });
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("status")).toContainText("a new link has been sent");
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("region", { name: "Sign in", exact: true }).getByRole("alert")).toContainText("Verify your email before signing in");
  await expect(page.getByRole("button", { name: "Resend verification email" })).toBeVisible();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByRole("button", { name: "Send password reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  expect(requests.at(-1)?.body).toEqual({ email: "test@example.com", redirectTo: "/sign-in?reset=true" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/sign-in?reset=true&token=test-reset-token");
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("new-password-123");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText("Your password has been updated");
  expect(requests.at(-1)?.body).toEqual({ token: "test-reset-token", newPassword: "new-password-123" });
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/sign-in?reset=true&error=INVALID_TOKEN");
  await expect(page.getByRole("region", { name: "Sign in", exact: true }).getByRole("alert")).toContainText("This reset link is invalid or has expired");
  await expect(page.getByRole("button", { name: "Send password reset link" })).toBeVisible();
});

test("successful email sign-in reaches the invitation gate without Google configuration", async ({ page }) => {
  let signedIn = false;
  await mockSession(page, {
    user: { id: "test-user", name: "Test Hustler", email: "test@example.com" },
    query: (path) => {
      if (path === "auth:readiness") return { google: false, emailAndPassword: true };
      if (path === "users:viewer") return { email: "test@example.com", allowed: false };
      throw new Error(`Unexpected query: ${path}`);
    },
    mutate: () => { throw new Error("Unexpected mutation"); },
  });
  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/get-session") && !signedIn) return route.fulfill({ json: null });
    if (path.endsWith("/sign-in/email")) {
      signedIn = true;
      return route.fulfill({ json: { redirect: false, token: "test-token", user: { id: "test-user", email: "test@example.com", name: "Test Hustler", emailVerified: true } } });
    }
    return route.fallback();
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "An invitation is needed." })).toBeVisible();
});
