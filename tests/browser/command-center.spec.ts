import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockSession } from "./helpers/mock-session";
import { emptyCohortReport } from "./helpers/command-center";

const profile = { _id: "hustler-profile", _creationTime: 1, authUserId: "hustler-user", name: "Test Hustler", email: "hustler@example.com", isAlumni: false, suspended: false };
const organizer = { ...profile, _id: "organizer-profile", name: "Organizer", email: "organizer@example.com", authUserId: "organizer-user" };
const cohort = { _id: "test-cohort", _creationTime: 1, name: "First chapter", description: "", startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "active", createdBy: organizer._id };

test("organizer sections support direct links, retained filters, browser history, and keyboard navigation", async ({ page }) => {
  const queries = new Set<string>();
  await mockSession(page, {
    user: { id: organizer.authUserId, name: organizer.name, email: organizer.email },
    query(path) {
      queries.add(path);
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: organizer.name, email: organizer.email, profile: organizer, isOrganizer: true, participantCohortIds: [], allowed: true, needsProvisioning: false };
        case "cohorts:list": return [cohort];
        case "cohorts:roster": return { participants: [], invitations: [] };
        case "onboarding:required": return null;
        case "commandCenter:cohortSummary": return emptyCohortReport(cohort);
        case "opportunities:list": return { entries: [], context: { interests: [], categories: [] } };
        case "ingestion:status": return { sources: [], runs: [], intervalDays: 1, month: "2026-11" };
        case "notifications:inbox": case "notifications:deliveries": case "openDoors:catalog": case "openDoors:ownOffers": case "openDoors:requests": return [];
        case "commandCenter:operations": return { oauthConfigured: true, emailConfigured: false, httpsSite: false, organizerCount: 2, failedEmails: 0, disabledEmails: 0, failedImports: 0, stuckImports: 0 };
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate(path) { throw new Error(`Unexpected mutation: ${path}`); },
  });
  await page.goto("/organizer");
  await expect(page.getByRole("heading", { name: "Follow-ups", exact: true })).toBeVisible();
  expect(queries.has("ingestion:status")).toBe(false);
  expect(queries.has("openDoors:requests")).toBe(false);
  await page.getByRole("tab", { name: "Opportunities", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search listings", exact: true }).fill("prototype");
  await page.getByRole("tab", { name: "Imports", exact: true }).click();
  await expect(page).toHaveURL(/#imports$/);
  await expect(page.getByRole("heading", { name: "Import sources", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("searchbox", { name: "Search listings", exact: true })).toHaveValue("prototype");
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "System status", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Settings", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Cohorts", exact: true }).click();
  await page.getByRole("tab", { name: /^Participants/ }).click();
  await expect(page.getByRole("button", { name: "Invite Hustler", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  const tabs = page.getByRole("tablist", { name: "Command Center sections", exact: true });
  await tabs.getByRole("tab", { name: "Cohorts", exact: true }).focus();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await expect(tabs.getByRole("tab", { name: "Opportunities", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("participant can request help while onboarding, retry a failed save and resolve it at 320px", async ({ page }) => {
  let checkin: Record<string, unknown> | null = null, failOnce = true;
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path) {
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: profile.name, email: profile.email, profile, isOrganizer: false, participantCohortIds: [cohort._id], allowed: true, needsProvisioning: false };
        case "cohorts:list": return [cohort];
        case "onboarding:required": return cohort._id;
        case "onboarding:get": return null;
        case "commandCenter:ownCheckin": return checkin;
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate(path, args) {
      if (path === "commandCenter:checkIn") {
        if (failOnce) { failOnce = false; throw new Error("Unable to send check-in. Try again."); }
        checkin = { _id: "checkin", _creationTime: 1, profileId: profile._id, cohortId: cohort._id, message: args.message, status: "open", revision: 1, updatedAt: 1 }; return null;
      }
      if (path === "commandCenter:resolveCheckin") { checkin = { ...checkin, status: "resolved", revision: 2 }; return null; }
      if (path === "onboarding:saveDraft") return 1;
      throw new Error(`Unexpected mutation: ${path}`);
    },
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/onboarding");
  const trigger = page.getByRole("button", { name: "I need help", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "I need help", exact: true });
  await dialog.getByLabel("What do you need help with?").fill("I need help choosing useful mission goals.");
  await dialog.getByRole("button", { name: "Send help check-in" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Unable to send");
  await dialog.getByRole("button", { name: "Send help check-in" }).click();
  await expect(dialog).toHaveCount(0);
  await trigger.click(); await expect(dialog.getByText("Awaiting follow-up", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "I’m all set now" }).click();
  await expect(dialog).toHaveCount(0);
  expect(checkin).toMatchObject({ status: "resolved" });
  await trigger.click(); await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("organizer reviews explained flags, handles stale notes, resolves help and exports labeled results", async ({ page }) => {
  let note = "", resolved = false, failNote = true;
  const report = () => ({ ...emptyCohortReport(cohort), summary: { active: 1, onboardingIncomplete: 1, needingAttention: resolved ? 0 : 1, openCheckins: resolved ? 0 : 1, plannedMeetings: 1, completedActivities: 0, reportedOutcomes: 1, pendingRequests: 0, pendingInvitations: 0 }, participants: [{ profileId: profile._id, name: profile.name, email: profile.email, alumni: false, suspended: false, membershipStatus: "active", startDate: cohort.startDate, endDate: cohort.endDate, goals: [], totals: [],
    entries: [{ id: "meeting", title: "Feedback with an alumnus", kind: "meeting", scope: "personal", startAt: Date.parse("2026-11-06T18:00:00Z"), endAt: Date.parse("2026-11-06T18:30:00Z"), status: "planned", contribution: 0 }],
    outcomes: [{ _id: "outcome", title: "Useful prototype feedback", type: "feedback", date: "2026-11-04", quantity: 2, notes: "Self-reported detail" }],
    checkin: { _id: "checkin", message: "PRIVATE help message", status: resolved ? "resolved" : "open", revision: resolved ? 2 : 1 },
    note: note ? { note, revision: 1, organizerName: "Organizer" } : null,
    flags: resolved ? [] : [{ kind: "help", reason: "Participant explicitly asked for help." }], pendingRequests: 0, unansweredRequests: 0 }] });
  await mockSession(page, {
    user: { id: organizer.authUserId, name: organizer.name, email: organizer.email },
    query(path) {
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: organizer.name, email: organizer.email, profile: organizer, isOrganizer: true, participantCohortIds: [], allowed: true, needsProvisioning: false };
        case "cohorts:list": return [cohort];
        case "onboarding:required": return null;
        case "cohorts:overview": return { cohorts: 1, participants: 1, pendingInvitations: 0 };
        case "cohorts:roster": return { participants: [], invitations: [] };
        case "commandCenter:cohortSummary": return report();
        case "commandCenter:operations": return { oauthConfigured: true, emailConfigured: false, httpsSite: false, organizerCount: 1, failedEmails: 1, disabledEmails: 1, failedImports: 0, stuckImports: 0 };
        case "opportunities:list": return { entries: [], context: { interests: [], categories: [] } };
        case "notifications:inbox": case "notifications:deliveries": case "openDoors:catalog": case "openDoors:ownOffers": case "openDoors:requests": return [];
        case "ingestion:status": return { settings: [], runs: [] };
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate(path, args) {
      if (path === "commandCenter:saveNote") {
        if (failNote) { failNote = false; throw new Error("Another organizer changed this note. Reopen it before saving."); }
        note = String(args.note); return null;
      }
      if (path === "commandCenter:resolveCheckin") { resolved = true; return null; }
      throw new Error(`Unexpected mutation: ${path}`);
    },
  });
  await page.goto("/organizer");
  await expect(page.getByText("Participant explicitly asked for help.", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/command-center-desktop.png", fullPage: true });
  const trigger = page.getByRole("button", { name: "Review participant", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Test Hustler · Cohort review", exact: true });
  await expect(dialog.getByText("PRIVATE help message", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Planned/, { exact: false })).toBeVisible();
  await expect(dialog.getByText("Useful prototype feedback", { exact: true })).toBeVisible();
  await dialog.getByLabel("Private organizer follow-up note").fill("PRIVATE organizer follow-up");
  await dialog.getByRole("button", { name: "Save private note" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Another organizer changed");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByLabel("Private organizer follow-up note").fill("PRIVATE organizer follow-up");
  await dialog.getByRole("button", { name: "Save private note" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Export cohort CSVs", exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Outcomes CSV", exact: true }).click()]);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("Self-reported; unverified"); expect(csv).not.toContain("PRIVATE");
  await page.setViewportSize({ width: 320, height: 900 });
  await trigger.click(); await dialog.getByRole("button", { name: "Mark check-in resolved" }).click();
  await expect(dialog).toHaveCount(0); await expect(trigger).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Needs attention only", exact: true }).uncheck();
  await expect(trigger).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/command-center-mobile.png", fullPage: true });
});
