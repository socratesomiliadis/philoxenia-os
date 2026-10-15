import { expect, test, type Page } from "@playwright/test";
import { mockSession } from "./helpers/mock-session";
import { DEFAULT_LUMA_FEED_URL } from "../../lib/ingestion";
import type { Opportunity } from "../../lib/opportunities";
import { chooseField } from "./helpers/ui";

async function importSession(page: Page, entries: Opportunity[] = []) {
  const profile = { _id: "organizer", _creationTime: 1, authUserId: "user", name: "Organizer", email: "organizer@example.com", isAlumni: false, suspended: false };
  const sources = ["luma", "serpapi"].map((provider) => ({ provider, enabled: false, autoPublish: false, monthlyLimit: provider === "serpapi" ? 200 : undefined, feedUrl: provider === "luma" ? DEFAULT_LUMA_FEED_URL : undefined, configured: true, reserved: 0, runs: 0, stale: false }));
  const runs: Record<string, unknown>[] = []; let csvFail = true;
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query: (path) => {
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: profile.name, email: profile.email, profile, isOrganizer: true, participantCohortIds: [], allowed: true, needsProvisioning: false };
        case "cohorts:list": case "notifications:inbox": case "notifications:deliveries": case "openDoors:catalog": case "openDoors:ownOffers": case "openDoors:requests": return [];
        case "onboarding:required": return null;
        case "cohorts:overview": return { cohorts: 0, participants: 0, pendingInvitations: 0 };
        case "opportunities:list": return { entries, context: { interests: [], categories: [] } };
        case "ingestion:status": return { sources, runs, intervalDays: 7, month: "2026-10" };
        default: throw new Error(`Unexpected query ${path}`);
      }
    },
    mutate: (path, args) => {
      if (path === "ingestion:configure") { Object.assign(sources.find((s) => s.provider === args.provider)!, args); return null; }
      if (path === "ingestion:refresh") {
        const source = sources.find((s) => s.provider === args.provider)!; source.reserved += source.provider === "luma" ? 0 : 2; source.runs++;
        runs.unshift({ _id: "run", provider: args.provider, trigger: "manual", startedAt: Date.parse("2026-10-15T12:00:00Z"), status: "succeeded", added: 2, updated: 1, skipped: 0 }); return "run";
      }
      if (path === "ingestion:importYc") { if (csvFail) { csvFail = false; throw new Error("Row 2: Use the original YC company directory link."); } return { added: 1, updated: 0, skipped: 0 }; }
      throw new Error(`Unexpected mutation ${path}`);
    },
  });
}

test("organizers configure bounded imports, refresh, inspect usage and retry a CSV at mobile widths", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("[CONVEX M(ingestion:importYc)] Row 2:")) errors.push(message.text()); });
  await importSession(page); await page.goto("/organizer");
  await page.getByRole("button", { name: "Manage imports", exact: true }).click();
  const source = page.getByRole("heading", { name: "Luma · iCal", exact: true }).locator("..").locator("..");
  await source.getByRole("button", { name: "Configure source", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure Luma · iCal", exact: true });
  await chooseField(page, "Import source", "Enabled");
  await expect(dialog.getByLabel("Luma iCal subscription URL", { exact: true })).toHaveValue(DEFAULT_LUMA_FEED_URL);
  await dialog.getByLabel("Luma iCal subscription URL", { exact: true }).fill(DEFAULT_LUMA_FEED_URL.replace("https:", "webcal:"));
  await expect(dialog.getByLabel(/Monthly allowance/)).toHaveCount(0);
  await chooseField(page, "New event publication", "Publish automatically");
  await dialog.getByRole("button", { name: "Save source settings", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await source.getByRole("button", { name: "Refresh source", exact: true }).click();
  await expect(source.getByText("Refreshes this month", { exact: true })).toBeVisible();
  await expect(source.getByRole("definition").first()).toHaveText("1");
  await expect(page.getByText(/2 added · 1 updated · 0 skipped/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Import YC CSV", exact: true }).click();
  let csvDialog = page.getByRole("dialog", { name: "Import YC directory CSV", exact: true });
  await expect(csvDialog.getByRole("link", { name: "Download CSV template", exact: true })).toHaveAttribute("href", "/templates/yc-opportunities.csv");
  await csvDialog.getByLabel("CSV contents", { exact: true }).fill("title,summary,description,sourceUrl,interests,area,location\nTest,Summary,Description,https://example.com,AI,sf,San Francisco");
  await csvDialog.getByRole("button", { name: "Import directory drafts", exact: true }).click();
  await expect(csvDialog.getByRole("alert")).toContainText("Row 2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await csvDialog.getByRole("button", { name: "Import directory drafts", exact: true }).click();
  await expect(csvDialog).toHaveCount(0); await expect(page.getByText("1 YC drafts added; 0 source records updated; 0 unchanged.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Import YC CSV", exact: true }).click();
  csvDialog = page.getByRole("dialog", { name: "Import YC directory CSV", exact: true });
  await expect(csvDialog).toBeVisible(); await page.keyboard.press("Escape"); await expect(csvDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import YC CSV", exact: true })).toBeFocused();
  await page.screenshot({ path: "test-results/imports-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("preview shows import setup without making provider requests", async ({ page }) => {
  await page.goto("/preview/organizer"); await page.getByRole("button", { name: "Manage imports", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recent import runs", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Configure source", exact: true }).first()).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.getByRole("button", { name: "Import YC CSV", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("all-day Luma opportunities show dates and unknown pricing without inventing meeting times", async ({ page }) => {
  const entry: Opportunity = { _id: "all-day", title: "Builders conference", kind: "event", summary: "Meet builders across three days.", description: "Talks, workshops, and product feedback over three days.", interests: ["Developer tools"], categories: [], area: "sf", location: "San Francisco", sourceName: "Luma", sourceUrl: "https://luma.com/conference", status: "published", organizerPick: false, cost: "unknown", eventDate: "2026-10-20", eventEndDate: "2026-10-23", saved: false, updatedAt: 1 };
  await importSession(page, [entry]); await page.goto("/opportunities");
  await expect(page.getByRole("article").getByText("Oct 20, 2026 – Oct 22, 2026 · All day", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View Builders conference", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Builders conference", exact: true });
  await expect(dialog.getByText("Price not confirmed", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Adding it to your Sprint creates an untimed planning task/)).toBeVisible();
  await page.keyboard.press("Escape"); await page.goto("/organizer");
  await page.getByRole("button", { name: "Edit Builders conference", exact: true }).click();
  await expect(page.getByLabel("First day", { exact: true })).toHaveValue("2026-10-20");
  await expect(page.getByLabel("Last day (optional)", { exact: true })).toHaveValue("2026-10-22");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
