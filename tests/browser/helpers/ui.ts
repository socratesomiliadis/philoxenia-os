import type { Locator, Page } from "@playwright/test";

export async function chooseField(page: Page, label: string, option: string, scope?: Locator) {
  await (scope ?? page).getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
