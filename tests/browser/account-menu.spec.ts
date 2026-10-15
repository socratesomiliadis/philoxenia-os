import { expect, test } from "@playwright/test";
import type { CommunityInput } from "../../lib/open-doors";
import { mockSession } from "./helpers/mock-session";

test("account menu supports profile editing, saved sidebar settings, and sign-out retry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  const profile = { _id: "test-member", _creationTime: 1, authUserId: "test-user", name: "Alexandria Longname Example", email: "member@example.com", isAlumni: false, suspended: false };
  let community: CommunityInput = { bio: "", building: "", interests: "", offering: "" };
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path) {
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: profile.name, email: profile.email, profile: { ...profile, community }, isOrganizer: false, participantCohortIds: [], allowed: true, needsProvisioning: false };
        case "cohorts:list": case "notifications:inbox": return [];
        case "onboarding:required": return null;
        case "users:community": return [{ _id: profile._id, name: profile.name, isAlumni: false, isOrganizer: false, community, cohorts: [] }];
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate(path, args) {
      if (path !== "users:saveCommunity") throw new Error(`Unexpected mutation: ${path}`);
      community = args.input as CommunityInput;
      return null;
    },
  });
  let signOutAttempts = 0;
  await page.route("**/api/auth/sign-out", (route) => {
    signOutAttempts++;
    return signOutAttempts === 1
      ? route.fulfill({ status: 500, json: { message: "Please retry" } })
      : route.fulfill({ json: { success: true } });
  });
  await page.goto("/community");
  const account = page.getByRole("button", { name: `Account menu for ${profile.name}`, exact: true });
  const menu = page.getByRole("menu");
  await account.focus();
  await page.keyboard.press("Enter");
  await expect(menu.getByText(profile.name, { exact: true })).toBeVisible();
  await expect(menu.getByText(profile.email, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();

  await account.click();
  await menu.getByRole("menuitem", { name: "Community profile", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Your community profile", exact: true });
  await editor.getByLabel("Headline", { exact: true }).fill("Designer and builder");
  await editor.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(community.headline).toBe("Designer and builder");
  await expect(account).toBeFocused();

  await account.click();
  await menu.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("checkbox", { name: "Collapse sidebar", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  await expect(page.locator("#desktop-sidebar")).toHaveAttribute("data-state", "collapsed");
  await page.reload();
  await expect(page.locator("#desktop-sidebar")).toHaveAttribute("data-state", "collapsed");
  await account.click();
  await menu.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(menu.getByRole("alert")).toHaveText("Could not sign out. Try again.");
  await menu.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(signOutAttempts).toBe(2);
});
