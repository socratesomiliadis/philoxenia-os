import { emptyCohortReport } from "./helpers/command-center";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockSession } from "./helpers/mock-session";
import { sampleSprintData } from "../../lib/sample-sprint";
import { sampleOpportunities, sampleRecommendationContext } from "../../lib/sample-opportunities";
import { emptyProgress, type ActivityInput, type GoalLink, type OutcomeInput, type ProgressInput, type SprintData } from "../../lib/sprint";

async function sprintSession(page: Page, organizer = false) {
  const profile = { _id: "test-profile", _creationTime: 1, authUserId: "test-user", name: "Test Hustler", email: "hustler@example.com", isAlumni: false, suspended: false };
  const cohort = { _id: "test-cohort", _creationTime: 1, name: "First chapter", description: "", startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "upcoming", createdBy: "organizer-profile" };
  let data: SprintData = structuredClone({ ...sampleSprintData, cohortId: cohort._id, cohortName: cohort.name });
  let failProgress = true;
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
        case "cohorts:overview": return { cohorts: 1, participants: 1, pendingInvitations: 0 };
        case "cohorts:roster": return { participants: [{ _id: "test-membership", _creationTime: 1, profileId: "participant-profile", cohortId: cohort._id, status: "active", profile: { ...profile, _id: "participant-profile", name: "Other Hustler" }, isOrganizer: false }], invitations: [] };
        case "opportunities:list": return { entries: [{ ...sampleOpportunities[0], isSample: false }], context: sampleRecommendationContext };
        case "sprint:get": return { ...data, readOnly: !!args.profileId, canPlan: !args.profileId, profileName: args.profileId ? "Other Hustler" : profile.name };
        case "sprint:shared": return { ...data, entries: data.entries.filter((entry) => entry.scope === "cohort").map((entry) => ({ ...entry, progress: emptyProgress })), goals: [], outcomes: [], management: true };
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate: (path, args) => {
      if (path === "sprint:saveActivity") {
        const input = args.input as ActivityInput;
        const existing = data.entries.find((entry) => entry._id === args.activityId);
        const id = existing?._id ?? `activity-${data.entries.length}`;
        const revision = (existing?.revision ?? 0) + 1;
        const entry = { ...existing, ...input, day: input.day, startAt: input.startAt, endAt: input.endAt, _id: id, scope: args.scope as "personal" | "cohort", revision, updatedAt: Date.now(), calendarUid: `${id}.test@philoxenia.hustlehours.com`,
          opportunityId: args.opportunityId as string | undefined, sourceUrl: args.opportunityId ? sampleOpportunities[0].sourceUrl : existing?.sourceUrl,
          progress: { ...existing?.progress ?? emptyProgress, goalLink: args.goalLink as GoalLink | undefined, revision: (existing?.progress.revision ?? 0) + 1, activityRevision: revision } };
        data = { ...data, entries: [...data.entries.filter((item) => item._id !== id), entry] }; return id;
      }
      if (path === "sprint:setProgress") {
        if (failProgress) { failProgress = false; throw new Error("Unable to save progress. Try again."); }
        data = { ...data, entries: data.entries.map((entry) => entry._id === args.activityId ? { ...entry, progress: { ...entry.progress, ...args.input as ProgressInput, revision: entry.progress.revision + 1, activityRevision: entry.revision, updatedAt: Date.now() } } : entry) }; return null;
      }
      if (path === "sprint:removeActivity") {
        const entry = data.entries.find((item) => item._id === args.activityId)!;
        data = { ...data, entries: entry.scope === "cohort" ? data.entries.map((item) => item._id === args.activityId ? { ...item, cancelledAt: Date.now(), revision: item.revision + 1 } : item) : data.entries.filter((item) => item._id !== args.activityId) }; return null;
      }
      if (path === "sprint:restoreActivity") { data = { ...data, entries: data.entries.map((entry) => entry._id === args.activityId ? { ...entry, cancelledAt: undefined, revision: entry.revision + 1 } : entry) }; return null; }
      if (path === "sprint:saveOutcome") {
        const outcome = { ...args.input as OutcomeInput, _id: args.outcomeId as string ?? `outcome-${data.outcomes.length}`, activityId: args.activityId as string | undefined, updatedAt: Date.now() };
        data = { ...data, outcomes: [...data.outcomes.filter((item) => item._id !== outcome._id), outcome] }; return outcome._id;
      }
      if (path === "sprint:removeOutcome") { data = { ...data, outcomes: data.outcomes.filter((item) => item._id !== args.outcomeId) }; return null; }
      throw new Error(`Unexpected mutation: ${path}`);
    },
  });
}

test("sample Sprint supports rescheduling, overlap acknowledgement, completion, outcomes, refresh, removal, and calendar export on mobile", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/preview/sprint");
  await page.getByRole("button", { name: "Reset sample Sprint", exact: true }).click();
  await page.getByRole("button", { name: "Add activity", exact: true }).click();
  let editor = page.getByRole("dialog", { name: "Add activity", exact: true });
  await editor.getByRole("textbox", { name: /^Activity title/ }).fill("Write a usable feedback question");
  await editor.getByLabel("Link to mission goal", { exact: true }).selectOption("0");
  await editor.getByRole("button", { name: "Add to Sprint", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole("button", { name: "View activity Write a usable feedback question", exact: true }).click();
  let details = page.getByRole("dialog", { name: "Write a usable feedback question", exact: true });
  await details.getByRole("button", { name: "Edit activity", exact: true }).click();
  editor = page.getByRole("dialog", { name: "Edit activity", exact: true });
  await editor.getByRole("checkbox", { name: "Schedule a time" }).check();
  await editor.getByLabel(/^Starts \(SF time\)/).fill("2026-11-03T15:15");
  await editor.getByLabel(/^Ends \(SF time\)/).fill("2026-11-03T15:45");
  await expect(editor.getByText("Overlaps: Prototype feedback with a fellow builder", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Save activity", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("Review the overlapping");
  await editor.getByRole("checkbox", { name: "Keep overlapping time" }).check();
  await editor.getByRole("button", { name: "Save activity", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await details.getByRole("button", { name: "Update progress", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Progress & attendance", exact: true });
  await progress.getByLabel("Activity status", { exact: true }).selectOption("completed");
  await progress.getByLabel(/^Contribution to this goal/).fill("3");
  await progress.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(progress).toHaveCount(0);
  await details.getByRole("button", { name: "Record outcome", exact: true }).click();
  const outcome = page.getByRole("dialog", { name: "Record outcome", exact: true });
  await outcome.getByLabel("Outcome type", { exact: true }).selectOption("feedback");
  await outcome.getByRole("textbox", { name: /^What happened/ }).fill("Learned which prototype screen to simplify");
  await outcome.getByRole("button", { name: "Save outcome", exact: true }).click();
  await expect(outcome).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Test what you’re building", exact: true })).toHaveAttribute("value", "3");
  await expect(page.getByRole("heading", { name: "Learned which prototype screen to simplify", exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Sprint", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("philoxenia-sprint.ics");
  const calendar = await readFile((await download.path())!, "utf8");
  expect(calendar).toContain("BEGIN:VEVENT"); expect(calendar).toContain("BEGIN:VTODO"); expect(calendar).toContain("SUMMARY:Write a usable feedback question");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Day 2, Nov 3", exact: true }).click();
  await page.getByRole("button", { name: "View activity Write a usable feedback question", exact: true }).click();
  details = page.getByRole("dialog", { name: "Write a usable feedback question", exact: true });
  expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await details.getByRole("button", { name: "Remove activity", exact: true }).click();
  const removing = page.getByRole("dialog", { name: "Remove this activity?", exact: true });
  await removing.getByRole("button", { name: "Remove activity", exact: true }).click();
  await expect(removing).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View activity Write a usable feedback question", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Learned which prototype screen to simplify", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Test what you’re building", exact: true })).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "Full agenda", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sunday, Nov 15", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("progress keeps zero contributions and requires a fresh count when linking a different goal", async ({ page }) => {
  await page.goto("/preview/sprint");
  await page.getByRole("button", { name: "Reset sample Sprint", exact: true }).click();
  await page.getByRole("button", { name: "View activity Prepare a two-minute product story", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Prepare a two-minute product story", exact: true });
  const progress = page.getByRole("dialog", { name: "Progress & attendance", exact: true });
  const contribution = progress.getByLabel(/^Contribution to this goal/);
  const save = progress.getByRole("button", { name: "Save progress", exact: true });

  await details.getByRole("button", { name: "Update progress", exact: true }).click();
  await progress.getByLabel("Activity status", { exact: true }).selectOption("completed");
  await contribution.fill("0");
  await save.click();
  await expect(progress).toHaveCount(0);
  await details.getByRole("button", { name: "Update progress", exact: true }).click();
  await expect(contribution).toHaveValue("0");
  await save.click();
  await expect(progress).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: sampleSprintData.goals[0].title, exact: true })).toHaveAttribute("value", "0");

  await page.getByRole("button", { name: "View activity Prepare a two-minute product story", exact: true }).click();
  await details.getByRole("button", { name: "Update progress", exact: true }).click();
  await contribution.fill("3");
  await save.click();
  await expect(progress).toHaveCount(0);
  await details.getByRole("button", { name: "Update progress", exact: true }).click();
  await expect(contribution).toHaveValue("3");
  await progress.getByLabel("Link to mission goal", { exact: true }).selectOption("1");
  await expect(contribution).toHaveValue("0");
  await contribution.fill("2");
  await save.click();
  await expect(progress).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: sampleSprintData.goals[0].title, exact: true })).toHaveAttribute("value", "0");
  await expect(page.getByRole("progressbar", { name: sampleSprintData.goals[1].title, exact: true })).toHaveAttribute("value", "2");
});

test("authenticated opportunity additions persist, prevent duplicates, and support attendance retry and exports", async ({ page }) => {
  await sprintSession(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "View Builders & good questions", exact: true }).click();
  let details = page.getByRole("dialog", { name: "Builders & good questions", exact: true });
  await details.getByRole("button", { name: "Add to Sprint", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Add opportunity to Sprint", exact: true });
  await expect(editor.getByLabel(/^Starts \(SF time\)/)).toHaveValue("2026-11-04T18:00");
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await editor.getByLabel("Link to mission goal", { exact: true }).selectOption("1");
  await editor.getByRole("button", { name: "Add to Sprint", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await details.getByRole("button", { name: "Add to Sprint", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Already in your Sprint", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open Sprint", exact: true }).click();
  await page.getByRole("button", { name: "Day 3, Nov 4", exact: true }).click();
  await page.getByRole("button", { name: "View activity Builders & good questions", exact: true }).click();
  details = page.getByRole("dialog", { name: "Builders & good questions", exact: true });
  await details.getByRole("button", { name: "Update progress", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Progress & attendance", exact: true });
  await progress.getByLabel("Activity status", { exact: true }).selectOption("completed");
  await progress.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(progress.getByRole("alert")).toHaveText("Unable to save progress. Try again.");
  await progress.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(progress).toHaveCount(0);
  await expect(details.getByText("Attended", { exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await details.getByRole("button", { name: "Export activity", exact: true }).click();
  const calendar = await readFile((await (await downloading).path())!, "utf8");
  expect(calendar).toContain("DTSTART:20261105T020000Z");
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Find your people", exact: true })).toHaveAttribute("value", "1");
});

test("organizers manage shared challenges and can inspect a participant’s Sprint without editing private records", async ({ page }) => {
  await sprintSession(page, true);
  await page.goto("/organizer");
  await page.getByRole("button", { name: "Manage cohort Sprint", exact: true }).click();
  const management = page.getByRole("dialog", { name: "Manage cohort Sprint", exact: true });
  await management.getByRole("button", { name: "Add cohort activity", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Add cohort activity", exact: true });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await editor.getByLabel("Activity type", { exact: true }).selectOption("challenge");
  await editor.getByRole("textbox", { name: /^Activity title/ }).fill("Share one useful founder insight");
  await editor.getByRole("button", { name: "Add to Sprint", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await management.getByRole("button", { name: "View activity Share one useful founder insight", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Share one useful founder insight", exact: true });
  await expect(details.getByRole("button", { name: "Update progress", exact: true })).toHaveCount(0);
  await details.getByRole("button", { name: "Cancel cohort activity", exact: true }).click();
  const cancelling = page.getByRole("dialog", { name: "Cancel this cohort activity?", exact: true });
  await cancelling.getByRole("button", { name: "Cancel cohort activity", exact: true }).click();
  await expect(cancelling).toHaveCount(0);
  await management.getByText("Cancelled cohort activities (1)", { exact: true }).click();
  await management.getByRole("button", { name: "View activity Share one useful founder insight", exact: true }).click();
  await details.getByRole("button", { name: "Restore cohort activity", exact: true }).click();
  await expect(details.getByRole("button", { name: "Cancel cohort activity", exact: true })).toBeVisible();
  await expect(details.getByRole("button", { name: "Cancel cohort activity", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await management.getByRole("button", { name: "Close Sprint dialog", exact: true }).click();
  await expect(management).toHaveCount(0);
  await page.getByRole("button", { name: "Manage Other Hustler", exact: true }).click();
  await page.getByRole("menuitem", { name: "View Sprint", exact: true }).click();
  const participant = page.getByRole("dialog", { name: "Other Hustler Sprint", exact: true });
  await expect(participant.getByRole("heading", { name: "Other Hustler’s Sprint", exact: true })).toBeVisible();
  await expect(participant.getByRole("button", { name: "Add activity", exact: true })).toHaveCount(0);
  await participant.getByRole("button", { name: "View activity Prepare a two-minute product story", exact: true }).click();
  const privateActivity = page.getByRole("dialog", { name: "Prepare a two-minute product story", exact: true });
  await expect(privateActivity.getByRole("button", { name: "Edit activity", exact: true })).toHaveCount(0);
  await expect(privateActivity.getByRole("button", { name: "Update progress", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
