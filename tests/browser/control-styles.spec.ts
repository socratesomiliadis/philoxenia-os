import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`controls use borderless, contrasting surfaces with a ${colorScheme} system preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/preview/community");
    const search = page.locator('[data-slot="search-field"]');
    const role = page.getByRole("combobox", { name: "Community role", exact: true });
    const cohort = page.getByRole("combobox", { name: "Community cohort", exact: true });
    for (const control of [search, role, cohort]) {
      await expect(control).toHaveCSS("background-color", "rgb(245, 244, 241)");
      await expect(control).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
      await expect(control).toHaveCSS("border-radius", "12px");
    }
    const idleRoleShadow = await role.evaluate((element) => getComputedStyle(element).boxShadow);
    await role.focus();
    await expect(role).not.toHaveCSS("box-shadow", idleRoleShadow);
    const idleSearchShadow = await search.evaluate((element) => getComputedStyle(element).boxShadow);
    await page.getByRole("searchbox", { name: "Search community" }).focus();
    await expect(search).not.toHaveCSS("box-shadow", idleSearchShadow);

    await page.goto("/preview/opportunities");
    const filters = page.getByRole("button", { name: "Filters", exact: true });
    await expect(filters).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await filters.click();
    await expect(page.getByRole("combobox", { name: "Location", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.getByRole("button", { name: "Done", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.goto("/preview/sprint");
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add activity", exact: true });
    await dialog.getByText("Add notes (optional)", { exact: true }).click();
    await page.mouse.move(0, 0);
    for (const control of [dialog.getByLabel("Activity title", { exact: true }), dialog.getByLabel("Activity type", { exact: true })]) {
      await expect(control).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(control).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
    }
    for (const control of [dialog.getByLabel("Day (optional)", { exact: true }), dialog.getByLabel("Notes (optional)", { exact: true }), dialog.getByRole("button", { name: "Cancel", exact: true })]) {
      await expect(control).toHaveCSS("background-color", "rgb(245, 244, 241)");
      await expect(control).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
    }
    await expect(dialog.getByRole("button", { name: "Add to Sprint", exact: true })).toHaveCSS("background-color", "rgb(0, 60, 46)");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
    await page.goto("/preview/onboarding");
    await expect(page.getByRole("textbox", { name: "Your project", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });
}
