import { expect, test } from "@playwright/test";
import type { CommunityInput } from "../../lib/open-doors";
import { mockSession } from "./helpers/mock-session";

test("community profiles support discovery, full bios, and social links at mobile widths", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/preview/community");
  const search = page.getByRole("searchbox", { name: "Search community" });
  await search.fill("Athens");
  await expect(page.getByRole("heading", { name: "Sam · Sample Hustler", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alex · Sample alumnus", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View profile of Sam · Sample Hustler", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sam · Sample Hustler", exact: true });
  await expect(dialog.getByText(/Always up for a coffee/)).toBeVisible();
  const github = dialog.getByRole("link", { name: /on GitHub/ });
  await expect(github).toHaveAttribute("href", "https://github.com");
  await expect(github).toHaveAttribute("rel", "noopener noreferrer");
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "View profile of Sam · Sample Hustler", exact: true })).toBeFocused();
  await search.fill("no matching person");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(search).toHaveValue("");
  await page.getByRole("combobox", { name: "Community role", exact: true }).click();
  await page.getByRole("option", { name: "Alumni", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Alex · Sample alumnus", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Community cohort", exact: true }).click();
  await page.getByRole("option", { name: "Sample summer cohort", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Alex · Sample alumnus", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/community-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("combobox", { name: "Community role", exact: true }).click();
  await page.getByRole("option", { name: "Everyone", exact: true }).click();
  await page.getByRole("combobox", { name: "Community cohort", exact: true }).click();
  await page.getByRole("option", { name: "All cohorts", exact: true }).click();
  await page.screenshot({ path: "test-results/community-desktop.png", fullPage: true });
});

test("members can edit, retry, reload, and remove their social profile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let community: CommunityInput = { bio: "", building: "A useful app", interests: "Design", offering: "Feedback" };
  const profile = { _id: "test-member", _creationTime: 1, authUserId: "test-user", name: "Test Member", email: "member@example.com", isAlumni: false, suspended: false };
  const writes: CommunityInput[] = [];
  let failOnce = true;
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path) {
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: profile.name, email: profile.email, profile: { ...profile, community }, isOrganizer: false, participantCohortIds: [], allowed: true, needsProvisioning: false };
        case "cohorts:list": case "notifications:inbox": case "notifications:deliveries": return [];
        case "onboarding:required": return null;
        case "users:community": return [{ _id: profile._id, name: profile.name, isAlumni: false, isOrganizer: false, community, cohorts: [] }];
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate(path, args) {
      if (path !== "users:saveCommunity") throw new Error(`Unexpected mutation: ${path}`);
      if (failOnce) { failOnce = false; throw new Error("Unable to save profile. Try again."); }
      community = args.input as CommunityInput; writes.push(community); return null;
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Give your community a little introduction.", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit your profile", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your community profile", exact: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await dialog.boundingBox())!.width).toBeGreaterThan(900);
  const body = dialog.locator('[data-slot="workspace-dialog-body"]');
  const footer = dialog.locator('[data-slot="workspace-dialog-footer"]');
  const footerTop = (await footer.boundingBox())!.y;
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect((await footer.boundingBox())!.y).toBe(footerTop);
  await expect(dialog.getByRole("button", { name: "Save profile", exact: true })).toBeInViewport();
  await body.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: "test-results/profile-editor-desktop.png", fullPage: true });
  // Equivalent CSS viewport to a 1440 x 1000 display at 200% browser zoom.
  await page.setViewportSize({ width: 720, height: 500 });
  await expect(dialog.getByRole("button", { name: "Save profile", exact: true })).toBeInViewport();
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Save profile", exact: true })).toBeInViewport();
  await page.evaluate(() => { document.documentElement.dir = "ltr"; });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByLabel("Short bio", { exact: true })).toHaveValue("");
  await dialog.getByLabel("Headline", { exact: true }).fill("Designer and maker");
  await dialog.getByLabel("Location", { exact: true }).fill("Athens, Greece");
  await dialog.getByLabel("Short bio", { exact: true }).fill("Building useful things. Always up for a coffee.");
  await dialog.getByLabel("GitHub", { exact: true }).fill("https://example.com/wrong-platform");
  await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Enter a full GitHub URL");
  await expect(dialog.getByLabel("GitHub", { exact: true })).toBeFocused();
  await dialog.getByLabel("GitHub", { exact: true }).fill("https://github.com/test-member");
  await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Unable to save profile");
  await expect(dialog.getByLabel("Headline", { exact: true })).toHaveValue("Designer and maker");
  await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await expect(page.getByRole("link", { name: /on GitHub/ })).toHaveAttribute("href", "https://github.com/test-member");
  await page.reload();
  await page.getByRole("button", { name: "View profile of Test Member", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Designer and maker", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Edit your profile", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByLabel("GitHub", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("link", { name: /on GitHub/ })).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[1].socialLinks?.github).toBe("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
