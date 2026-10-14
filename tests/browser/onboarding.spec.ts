import { expect, test } from "@playwright/test";

test("four onboarding steps lead to three editable goals and explicit replacement confirmation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/preview");
  await page.getByRole("link", { name: "Set your personal mission" }).click();
  await expect(page.getByRole("heading", { name: "What are you building?" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/onboarding-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.getByRole("region", { name: "Workspace content", exact: true }).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "at least 10 characters" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your project", exact: true }).fill("A feedback tool for independent game developers.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Your ambitions", exact: true }).fill("Find three potential users and learn from their feedback.");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your project", exact: true })).toHaveValue("A feedback tool for independent game developers.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your ambitions", exact: true })).toHaveValue("Find three potential users and learn from their feedback.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Developer tools", exact: true }).click();
  await expect(page.getByRole("button", { name: "Developer tools", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Your contribution", exact: true }).fill("React prototypes and landing page reviews.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Use template goals", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Goal 1 title", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Goal 1 title", exact: true }).fill("Get four prototype reviews");
  await page.getByRole("spinbutton", { name: "Goal 1 target", exact: true }).fill("4");
  for (const width of [1440, 640, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const panel = page.getByRole("region", { name: "Workspace content", exact: true });
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.getByRole("textbox", { name: "Goal 1 title", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/onboarding-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Confirm my mission", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your mission is set." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Get four prototype reviews", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit your mission", exact: true }).click();
  await page.getByRole("button", { name: "Suggest new goals", exact: true }).click();
  await page.getByRole("button", { name: "View confirmed mission", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Get four prototype reviews", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
