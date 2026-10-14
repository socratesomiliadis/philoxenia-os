import { test, expect } from "@playwright/test";

test("preview navigation works on desktop and mobile without granting backend access", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/preview");
  await expect(page.getByRole("heading", { name: "Make this chapter yours." })).toBeVisible();
  await expect(page.getByText("Workspace preview · Sample cohort.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Command Center", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organizer Command Center" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New cohort", exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "Community", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your kind of people." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome, Hustler." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google sign-in is not connected yet" })).toBeDisabled();
  expect(errors).toEqual([]);
});
