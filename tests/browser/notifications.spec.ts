import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-session";

test("notifications open beside the bell, support read retries, and dismiss without a modal overlay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const profile = { _id: "test-member", _creationTime: 1, authUserId: "test-user", name: "Test Member", email: "member@example.com", isAlumni: true, suspended: false };
  let notifications = [{ _id: "notification-one", _creationTime: 1, profileId: profile._id, message: "Your invitation has been accepted.", createdAt: Date.now(), readAt: undefined as number | undefined }];
  let failOnce = true;
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path) {
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: profile.name, email: profile.email, profile, isOrganizer: false, participantCohortIds: [], allowed: true, needsProvisioning: false };
        case "onboarding:required": return null;
        case "cohorts:list": case "users:community": return [];
        case "notifications:inbox": return notifications;
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate(path) {
      if (path !== "notifications:read") throw new Error(`Unexpected mutation: ${path}`);
      if (failOnce) { failOnce = false; throw new Error("Unable to mark notification as read. Try again."); }
      notifications = notifications.map((item) => ({ ...item, readAt: Date.now() }));
      return null;
    },
  });
  await page.goto("/community");
  const bell = page.getByRole("button", { name: /^Notifications/ });
  await bell.click();
  const popover = page.locator('[data-slot="popover-content"]');
  await expect(popover.getByText("Your invitation has been accepted.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  const bellBox = (await bell.boundingBox())!, popupBox = (await popover.boundingBox())!;
  expect(popupBox.y).toBeGreaterThanOrEqual(bellBox.y + bellBox.height);
  expect(popupBox.width).toBeLessThanOrEqual(400);
  await popover.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(popover.getByRole("alert")).toContainText("Unable to mark notification");
  await popover.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(bell).toHaveAccessibleName("Notifications");
  await expect(popover.getByRole("button", { name: "Mark as read", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(bell).toBeFocused();
  await page.setViewportSize({ width: 320, height: 700 });
  await bell.click();
  const mobileBox = (await popover.boundingBox())!;
  expect(mobileBox.x).toBeGreaterThanOrEqual(0);
  expect(mobileBox.x + mobileBox.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "test-results/notifications-mobile.png", fullPage: true });
  await page.mouse.click(5, 600);
  await expect(popover).toHaveCount(0);
  notifications = [];
  await page.reload();
  await bell.click();
  await expect(popover.getByText("You’re all caught up.", { exact: true })).toBeVisible();
});
