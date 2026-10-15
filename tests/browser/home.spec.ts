import { expect, test } from "@playwright/test";

test("home shows a useful agenda, opens activity details, and reflects Sprint progress", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-11-02T18:30:00Z"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/preview");
  await expect(page.getByText("Day 1 of 14", { exact: true })).toBeVisible();
  await expect(page.getByText("Happening now", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Welcome to your two weeks/ }).click();
  const details = page.getByRole("dialog", { name: "Welcome to your two weeks", exact: true });
  await expect(details).toContainText("Meet the cohort");
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);

  await page.getByRole("link", { name: "Open your Sprint" }).click();
  await page.getByRole("button", { name: "View activity Prepare a two-minute product story", exact: true }).click();
  await page.getByRole("button", { name: "Update progress", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Progress & attendance", exact: true });
  await progress.getByLabel("Activity status", { exact: true }).selectOption("completed");
  await progress.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(progress).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  const momentum = page.getByRole("definition").filter({ hasText: /^1$/ });
  await expect(momentum).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Prepare a two-minute product story/ })).toHaveCount(0);

  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.getByRole("region", { name: "Workspace content", exact: true }).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
