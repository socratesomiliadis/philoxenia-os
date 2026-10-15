import { emptyCohortReport } from "./helpers/command-center";
import { expect, test, type Page } from "@playwright/test";
import { mockSession } from "./helpers/mock-session";
import { chooseField } from "./helpers/ui";
import { sampleOpportunities, sampleRecommendationContext } from "../../lib/sample-opportunities";
import { curatedOpportunities } from "../../lib/curated-opportunities";
import type { Opportunity, OpportunityInput } from "../../lib/opportunities";

const cohort = { _id: "test-cohort", _creationTime: 1, name: "First chapter", description: "", startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "upcoming", createdBy: "organizer-profile" };

async function catalogSession(page: Page, organizer = false, initial: Opportunity[] = []) {
  const profile = { _id: "test-profile", _creationTime: 1, authUserId: "test-user", name: "Test Hustler", email: "hustler@example.com", isAlumni: false, suspended: false };
  let entries = initial.map((entry) => ({ ...entry }));
  let failBookmark = !organizer;
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query: (path, args) => {
      switch (path) {
        case "notifications:inbox": case "notifications:deliveries": case "openDoors:catalog": case "openDoors:ownOffers": case "openDoors:requests": return [];
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: profile.name, email: profile.email, profile, isOrganizer: organizer, participantCohortIds: [cohort._id], allowed: true, needsProvisioning: false };
        case "cohorts:list": return [cohort];
        case "onboarding:required": return null;
        case "commandCenter:operations": return null;
        case "commandCenter:cohortSummary": return emptyCohortReport(cohort);
        case "cohorts:overview": return { cohorts: 1, participants: 0, pendingInvitations: 0 };
        case "cohorts:roster": return { participants: [], invitations: [] };
        case "opportunities:list": return { entries: args.management ? entries : entries.filter((entry) => entry.status === "published"), context: sampleRecommendationContext };
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate: (path, args) => {
      if (path === "opportunities:setBookmark") {
        if (failBookmark) { failBookmark = false; throw new Error("Unable to save this bookmark. Try again."); }
        entries = entries.map((entry) => entry._id === args.opportunityId ? { ...entry, saved: Boolean(args.saved) } : entry);
        return args.saved;
      }
      if (path === "opportunities:save") {
        const opportunity = args.opportunity as OpportunityInput;
        const id = args.opportunityId as string ?? `listing-${entries.length}`;
        const existing = entries.find((entry) => entry._id === id);
        const next = { ...opportunity, _id: id, updatedAt: Date.now(), saved: existing?.saved ?? false };
        entries = [...entries.filter((entry) => entry._id !== id), next];
        return id;
      }
      if (path === "opportunities:addCuratedStarters") {
        const additions = curatedOpportunities.filter((item) => !entries.some((entry) => entry.kind === item.kind && entry.sourceUrl === item.sourceUrl));
        entries = [...entries, ...additions.map((entry, index) => ({ ...entry, _id: `starter-${index}`, updatedAt: Date.now(), saved: false }))];
        return { added: additions.length };
      }
      throw new Error(`Unexpected mutation: ${path}`);
    },
  });
}

test("sample discovery supports search, event filters, Bay Area, saved listings, and accessible mobile details", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/preview/opportunities");
  await expect(page.getByRole("heading", { name: "Opportunities", exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(6);
  await page.getByRole("button", { name: "Save Builders & good questions", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unsave Builders & good questions", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Saved/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: /^Saved/ }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await chooseField(page, "Location", "Wider Bay Area (including SF)");
  await expect(page.getByRole("article")).toHaveCount(7);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await chooseField(page, "Event cost", "Price not confirmed");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Climate builders, together", exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await chooseField(page, "Event dates", "Choose dates");
  await page.getByLabel("From (SF date)", { exact: true }).fill("2026-11-04");
  await page.getByLabel("To (SF date)", { exact: true }).fill("2026-11-04");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search opportunities" }).fill("no such opportunity");
  await expect(page.getByRole("heading", { name: "No opportunities match these filters" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search opportunities" }).fill("builders feedback");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 850 });
  const open = page.getByRole("button", { name: "View Builders & good questions", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Builders & good questions", exact: true });
  await expect(dialog.getByRole("heading", { name: "Why this is here for you" })).toBeVisible();
  await expect(dialog.getByText("During your stay", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "View registration" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("authenticated bookmarks show failures inside details, retry, survive refresh, and can be removed", async ({ page }) => {
  await catalogSession(page, false, [{ ...sampleOpportunities[0], isSample: false, sourceName: "Original organizer", sourceUrl: "https://example.com/register" }]);
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "View Builders & good questions", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Builders & good questions", exact: true });
  await expect(dialog.getByRole("link", { name: "View registration" })).toHaveAttribute("href", "https://example.com/register");
  await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Unable to save this bookmark. Try again.");
  await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Unsave opportunity", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("button", { name: "Unsave Builders & good questions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Saved/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Unsave Builders & good questions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No saved opportunities here yet" })).toBeVisible();
});

test("event artwork loads in cards and details, with no card footer and a clean fallback", async ({ page }) => {
  const entry = { ...sampleOpportunities[0], isSample: false, imageUrl: "https://images.lumacdn.com/uploads/test-cover.png" };
  const missingImage = { ...entry, _id: "no-artwork", title: "An upcoming event without artwork", imageUrl: undefined };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await catalogSession(page, true, [entry, missingImage]);
  await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") }));
  await page.goto("/opportunities");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: entry.title, exact: true }) });
  const otherCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: missingImage.title, exact: true }) });
  await expect(card.locator("img")).toBeVisible();
  await card.locator("img").scrollIntoViewIfNeeded();
  await card.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await expect(card.getByText("During your stay", { exact: true })).toHaveCount(0);
  await expect(card.getByText("View details", { exact: true })).toHaveCount(0);
  const titleOffset = () => card.getByRole("heading").evaluate((heading) => heading.getBoundingClientRect().top - heading.closest("article")!.getBoundingClientRect().top);
  const imageOffset = await titleOffset();
  const fallbackOffset = await otherCard.getByRole("heading").evaluate((heading) => heading.getBoundingClientRect().top - heading.closest("article")!.getBoundingClientRect().top);
  expect(Math.abs(imageOffset - fallbackOffset)).toBeLessThan(1);
  const open = card.getByRole("button", { name: `View ${entry.title}`, exact: true });
  await open.focus();
  await open.press("Enter");
  const details = page.getByRole("dialog", { name: entry.title, exact: true });
  await expect(details.locator("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await page.setViewportSize({ width: 320, height: 850 });
  await expect(card.locator("img")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.unroute("**/_next/image?**");
  await page.route("**/_next/image?**", (route) => route.fulfill({ status: 404 }));
  await page.reload();
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(Math.abs(await titleOffset() - imageOffset)).toBeLessThan(1);
  await card.getByRole("button", { name: `View ${entry.title}`, exact: true }).click();
  await expect(details).toBeVisible();
});

test("discovery removes started events and updates when the next event begins", async ({ page }) => {
  const now = new Date("2026-10-15T18:00:00Z");
  await page.clock.install({ time: now });
  const upcoming = { ...sampleOpportunities[0], isSample: false, startAt: now.getTime() + 60_000, endAt: now.getTime() + 3_600_000 };
  const started = { ...upcoming, _id: "started", title: "An event that already started", startAt: now.getTime() - 1 };
  await catalogSession(page, true, [started, upcoming]);
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: upcoming.title, exact: true })).toBeVisible();
  await page.clock.pauseAt(new Date(now.getTime() + 1_000));
  await expect(page.getByRole("heading", { name: started.title, exact: true })).toHaveCount(0);
  await page.clock.fastForward(59_000);
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("organizers create drafts, publish and archive events, and add real curated directory drafts", async ({ page }) => {
  await catalogSession(page, true);
  await page.goto("/organizer#opportunities");
  await page.getByRole("button", { name: "Add opportunity", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add opportunity", exact: true });
  await dialog.getByRole("textbox", { name: /^Title/ }).fill("Pilot builder workshop");
  await dialog.getByRole("textbox", { name: "Short summary" }).fill("Meet other builders and discuss developer tools.");
  await dialog.getByRole("textbox", { name: "Details and what to expect" }).fill("Bring your prototype and one question. Register with the original event organizer before attending.");
  await dialog.getByText("Developer tools", { exact: true }).click();
  await dialog.getByLabel(/^Starts \(SF time\)/).fill("2026-11-04T18:00");
  await dialog.getByRole("textbox", { name: /^Original source name/ }).fill("Workshop organizer");
  await dialog.getByRole("textbox", { name: /^Original source URL/ }).fill("https://example.com/pilot-workshop");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Pilot builder workshop", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit opportunity", exact: true });
  await expect(dialog.getByLabel(/^Starts \(SF time\)/)).toHaveValue("2026-11-04T18:00");
  await chooseField(page, "Publication status", "Published · all members", dialog);
  await dialog.getByRole("button", { name: "Publish opportunity", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "Pilot builder workshop", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Manage opportunities", exact: true }).click();
  await page.getByRole("button", { name: "Edit Pilot builder workshop", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit opportunity", exact: true });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await chooseField(page, "Publication status", "Archived · organizers only", dialog);
  await dialog.getByRole("button", { name: "Archive opportunity", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Catalog actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add curated starters", exact: true }).click();
  await expect(page.getByText("Added 4 directory drafts", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit LangChain", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "No published opportunities yet" })).toBeVisible();
});

test("alumni publishing requires confirmation and distinguishes a support request from a public founder profile", async ({ page }) => {
  await catalogSession(page, true, [{ ...sampleOpportunities[3], isSample: false }]);
  await page.goto("/organizer#opportunities");
  await page.getByRole("button", { name: "Add opportunity", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Add opportunity", exact: true });
  await chooseField(page, "Type", "Alumni offer", editor);
  await chooseField(page, "Publication status", "Published · all members", editor);
  await editor.getByRole("textbox", { name: /^Title/ }).fill("A focused product review");
  await editor.getByRole("textbox", { name: "Short summary" }).fill("Get feedback on a prototype from an alumnus.");
  await editor.getByRole("textbox", { name: "Details and what to expect" }).fill("Bring one product question and a prototype. The alumnus will reply to your request with their available times.");
  await editor.getByText("Developer tools", { exact: true }).click();
  await editor.getByRole("textbox", { name: /^Alumnus offering support/ }).fill("Test Alumnus");
  await editor.getByRole("textbox", { name: "Support and how to request it" }).fill("Submit a short product description through the booking form for a review.");
  await editor.getByRole("textbox", { name: /^Request \/ booking URL/ }).fill("https://example.com/book-review");
  await editor.getByRole("textbox", { name: /^Availability and capacity/ }).fill("Two 30-minute reviews in November");
  await editor.getByRole("textbox", { name: /^Original source name/ }).fill("Alumnus profile");
  await editor.getByRole("textbox", { name: /^Original source URL/ }).fill("https://example.com/alumnus");
  await editor.getByRole("button", { name: "Publish opportunity", exact: true }).click();
  const confirmation = editor.getByRole("checkbox", { name: /I confirmed this offer/ });
  await expect(confirmation).not.toBeChecked();
  expect(await editor.locator("form").evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(false);
  await expect(editor).toBeVisible();
  await confirmation.press("Space");
  await editor.getByRole("button", { name: "Publish opportunity", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "Alumni offers", exact: true }).click();
  await page.getByRole("button", { name: "View A focused product review", exact: true }).click();
  const details = page.getByRole("dialog", { name: "A focused product review", exact: true });
  await expect(details.getByRole("link", { name: "Request support on provider site" })).toHaveAttribute("href", "https://example.com/book-review");
  await expect(details.getByRole("heading", { name: "Support from Test Alumnus" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Founders", exact: true }).click();
  await page.getByRole("button", { name: "View Alex Morgan · Fieldnotes", exact: true }).click();
  const directory = page.getByRole("dialog", { name: "Alex Morgan · Fieldnotes", exact: true });
  await expect(directory.getByText("Public directory entry. An introduction, meeting, or visit has not been arranged.", { exact: true })).toBeVisible();
  await expect(directory.getByRole("link", { name: "Request support on provider site" })).toHaveCount(0);
});
