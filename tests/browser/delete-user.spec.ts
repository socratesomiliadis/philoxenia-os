import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-session";

test("organizer deletion requires the target email, supports cancel and retry, and removes the user from the roster", async ({ page }) => {
  const organizer = { _id: "organizer-profile", _creationTime: 1, authUserId: "organizer-user", name: "Organizer", email: "organizer@example.com", isAlumni: false, suspended: false };
  const profile = { ...organizer, _id: "hustler-profile", authUserId: "hustler-user", name: "Test Hustler", email: "hustler@example.com" };
  const cohort = { _id: "test-cohort", _creationTime: 1, name: "First chapter", description: "", startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "upcoming", createdBy: organizer._id };
  let deleted = false;
  let failNext = true;
  const deletions: Record<string, unknown>[] = [];
  await mockSession(page, {
    user: { id: organizer.authUserId, name: organizer.name, email: organizer.email },
    query: (path) => {
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: organizer.name, email: organizer.email, profile: organizer, isOrganizer: true, participantCohortIds: [], allowed: true, needsProvisioning: false };
        case "cohorts:list": return [cohort];
        case "onboarding:required": return null;
        case "opportunities:list": return { entries: [], context: { interests: [], categories: [] } };
        case "cohorts:overview": return { cohorts: 1, participants: deleted ? 0 : 1, pendingInvitations: 0 };
        case "cohorts:roster": return { participants: deleted ? [] : [{ _id: "test-membership", _creationTime: 1, profileId: profile._id, cohortId: cohort._id, status: "active", profile, isOrganizer: false }], invitations: [] };
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate: (path, args) => {
      if (path !== "users:deleteUser") throw new Error(`Unexpected mutation: ${path}`);
      deletions.push(args);
      if (failNext) { failNext = false; throw new Error("Unable to delete user. Try again."); }
      deleted = true;
      return { email: profile.email };
    },
  });
  await page.goto("/organizer");
  await page.getByRole("button", { name: "Manage Test Hustler", exact: true }).click();
  await page.getByRole("menuitem", { name: "Manage access and dates", exact: true }).click();
  await page.getByRole("button", { name: "Delete user", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Test Hustler?", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete user permanently" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(deletions).toHaveLength(0);

  await page.getByRole("button", { name: "Manage Test Hustler", exact: true }).click();
  await page.getByRole("menuitem", { name: "Manage access and dates", exact: true }).click();
  await page.getByRole("button", { name: "Delete user", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 900 });
  await dialog.getByRole("textbox", { name: "Type the email to confirm" }).fill("wrong@example.com");
  await expect(dialog.getByRole("button", { name: "Delete user permanently" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Type the email to confirm" }).fill(profile.email);
  await dialog.getByRole("button", { name: "Delete user permanently" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Unable to delete user. Try again.");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Delete user permanently" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No participants yet" })).toBeVisible();
  await expect(page.getByText("You can invite this email again to start fresh.", { exact: false })).toBeVisible();
  expect(deletions).toEqual([{ profileId: profile._id, confirmationEmail: profile.email }, { profileId: profile._id, confirmationEmail: profile.email }]);
});
