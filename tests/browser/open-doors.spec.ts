import { expect, test, type Page } from "@playwright/test";
import { mockSession } from "./helpers/mock-session";
import { emptyProgress, type SprintData } from "../../lib/sprint";
import type { OfferInput } from "../../lib/open-doors";

test("sample alternatives require acceptance and agreed support can enter the Sprint at mobile widths", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview/open-doors");
  await page.getByRole("button", { name: "Reset sample Open Doors", exact: true }).click();
  await page.getByRole("button", { name: "Request support", exact: true }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/What do you want to achieve/).fill("Explain my project more clearly to founders.");
  await dialog.getByLabel(/Why is this support a good fit/).fill("Your portfolio feedback will help me improve my prototype.");
  await dialog.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.locator("section").getByText("Awaiting reply", { exact: true })).toBeVisible();
  await page.getByLabel("Sample role", { exact: true }).selectOption("alumnus");
  await page.getByRole("button", { name: /^Requests \(/ }).click();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await page.getByLabel("Reply or alternative support", { exact: true }).fill("I can review one project asynchronously and share written feedback.");
  await page.getByRole("button", { name: "Propose alternative", exact: true }).click();
  await expect(page.locator("section").getByText("Alternative proposed", { exact: true })).toBeVisible();
  await page.getByLabel("Sample role", { exact: true }).selectOption("participant");
  await page.getByRole("button", { name: /^Requests \(/ }).click();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await expect(page.getByRole("button", { name: "Schedule in Sprint", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Accept alternative", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Requests \(/ }).click();
  await expect(page.locator("section").getByText("Support agreed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await page.getByRole("button", { name: "Schedule in Sprint", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Schedule agreed support", exact: true });
  await expect(dialog.getByLabel("Activity type", { exact: true })).toBeDisabled();
  await dialog.getByLabel(/^Starts \(SF time\)/).fill("2026-11-04T10:00");
  await dialog.getByLabel(/^Ends \(SF time\)/).fill("2026-11-04T10:30");
  await dialog.getByRole("button", { name: "Add to Sprint", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/preview/sprint");
  await page.getByRole("button", { name: "Full agenda", exact: true }).click();
  await expect(page.getByRole("button", { name: "View activity A fresh pair of eyes on your portfolio", exact: true })).toBeVisible();
  await page.goto("/preview/open-doors");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^Requests \(/ }).click();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await page.getByLabel("What happened during this support?", { exact: true }).fill("Reviewed the project together and improved the portfolio story.");
  await page.getByRole("button", { name: "Report support completed", exact: true }).click();
  await expect(page.getByText("Support completed", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/open-doors-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

async function doorsSession(page: Page) {
  let role = "participant", failSubmit = true;
  const hustler = { _id: "test-hustler", _creationTime: 1, authUserId: "test-user", name: "Test Hustler", email: "hustler@example.com", isAlumni: false, suspended: false };
  const alumnus = { ...hustler, _id: "test-alumnus", name: "Test Alumnus", email: "alumnus@example.com", isAlumni: true };
  const organizer = { ...hustler, _id: "test-organizer", name: "Organizer", email: "organizer@example.com" };
  const cohort = { _id: "test-cohort", _creationTime: 1, name: "First chapter", description: "", startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "completed", createdBy: organizer._id };
  const input: OfferInput = { title: "Review my portfolio", kind: "portfolio", description: "Review one project and share concrete improvements for the portfolio.", availability: "Agree a time after approval.", capacity: 1, connection: "", published: true };
  let offer = { ...input, _id: "test-offer", _creationTime: 1, ownerId: alumnus._id, revision: 1, updatedAt: 1 };
  let request: Record<string, unknown> | null = null, graduated = false;
  let sprint: SprintData = { cohortId: cohort._id, cohortName: cohort.name, startDate: cohort.startDate, endDate: cohort.endDate, goals: [], entries: [], outcomes: [], readOnly: false, canPlan: true, management: false };
  const notifications: Record<string, unknown>[] = [];
  const writes: { path: string; args: Record<string, unknown> }[] = [];
  await mockSession(page, {
    user: { id: hustler.authUserId, name: hustler.name, email: hustler.email },
    query(path, args) {
      const profile = role === "alumnus" ? alumnus : role === "organizer" ? organizer : hustler;
      switch (path) {
        case "auth:readiness": return { google: true };
        case "users:viewer": return { name: profile.name, email: profile.email, profile, isOrganizer: role === "organizer", participantCohortIds: role === "participant" ? [cohort._id] : [], allowed: true, needsProvisioning: false };
        case "cohorts:list": return [cohort];
        case "onboarding:required": return null;
        case "notifications:inbox": return notifications;
        case "notifications:deliveries": return [];
        case "openDoors:catalog": return [{ ...offer, ownerName: alumnus.name, remaining: request && ["alternative", "agreed"].includes(String(request.status)) ? 0 : 1, own: role === "alumnus" }];
        case "openDoors:ownOffers": return role === "alumnus" ? [offer] : [];
        case "openDoors:requests": return request ? [{ ...request, requesterName: hustler.name, alumnusName: alumnus.name, isRequester: role === "participant", isRecipient: role === "alumnus", meeting: sprint.entries[0] ? { title: sprint.entries[0].title, startAt: sprint.entries[0].startAt, endAt: sprint.entries[0].endAt } : null, outcomeCount: sprint.outcomes.length, coordination: args.organizer ? request.coordination ?? null : null }] : [];
        case "sprint:get": return sprint;
        case "sprint:shared": return { ...sprint, canPlan: true, management: true };
        case "cohorts:overview": return { cohorts: 1, participants: 1, pendingInvitations: 0 };
        case "cohorts:roster": return { participants: [{ _id: "membership", _creationTime: 1, profileId: hustler._id, cohortId: cohort._id, status: "active", profile: { ...hustler, isAlumni: graduated }, isOrganizer: false }], invitations: [] };
        case "opportunities:list": return { entries: [], context: { interests: [], categories: [] } };
        default: throw new Error(`Unexpected query: ${path}`);
      }
    },
    mutate(path, args) {
      writes.push({ path, args });
      if (path === "openDoors:submitRequest") {
        if (failSubmit) { failSubmit = false; throw new Error("Unable to submit request. Try again."); }
        request = { ...args, _id: "test-request", _creationTime: 1, requesterId: hustler._id, alumnusId: alumnus._id, offerSnapshot: input, revision: 1, updatedAt: 1, status: "pending" }; return "test-request";
      }
      if (path === "openDoors:respond") { request = { ...request, response: args.response, alternative: args.decision === "alternative" ? args.response : undefined, status: args.decision === "alternative" ? "alternative" : args.decision === "approve" ? "agreed" : "declined", revision: Number(request?.revision) + 1 }; return null; }
      if (path === "openDoors:participantDecision") { request = { ...request, status: args.accept ? "agreed" : "withdrawn", revision: Number(request?.revision) + 1 }; return null; }
      if (path === "openDoors:schedule") {
        const activity = args.input as SprintData["entries"][number];
        sprint = { ...sprint, entries: [{ ...activity, _id: "test-meeting", scope: "personal", revision: 1, updatedAt: 1, progress: { ...emptyProgress }, calendarUid: "test-meeting@philoxenia" }] };
        request = { ...request, activityId: "test-meeting", revision: Number(request?.revision) + 1 }; return "test-meeting";
      }
      if (path === "openDoors:complete") { request = { ...request, response: args.response, status: "completed", revision: Number(request?.revision) + 1 }; return null; }
      if (path === "openDoors:coordinate") { request = { ...request, coordination: { _id: "note", _creationTime: 1, requestId: request?._id, organizerId: organizer._id, note: args.note, updatedAt: 1 } }; return null; }
      if (path === "openDoors:graduate") { graduated = true; return null; }
      if (path === "openDoors:saveOffer") { offer = { ...offer, ...args.input as OfferInput, revision: offer.revision + 1 }; return offer._id; }
      if (path === "notifications:read") return null;
      if (path === "sprint:setProgress") { sprint = { ...sprint, entries: sprint.entries.map((entry) => ({ ...entry, progress: { ...entry.progress, ...args.input as typeof entry.progress, revision: 1 } })) }; return null; }
      if (path === "sprint:saveOutcome") { sprint = { ...sprint, outcomes: [{ ...args.input as SprintData["outcomes"][number], _id: "outcome", activityId: args.activityId as string, updatedAt: 1 }] }; return "outcome"; }
      throw new Error(`Unexpected mutation: ${path}`);
    },
  });
  return { setRole: (next: string) => { role = next; }, writes, getRequest: () => request };
}

test("connected request retries, alumnus decisions, Sprint attendance and outcomes, and organizer coordination work", async ({ page }) => {
  const session = await doorsSession(page);
  await page.goto("/open-doors");
  await page.getByRole("button", { name: "Request support", exact: true }).click();
  await page.getByLabel(/What do you want to achieve/).fill("Improve the story of my first prototype.");
  await page.getByLabel(/Why is this support a good fit/).fill("Your experience reviewing portfolios fits my work.");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Unable to submit request");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.locator("section").getByText("Awaiting reply", { exact: true })).toBeVisible();
  session.setRole("alumnus"); await page.reload();
  await page.getByRole("button", { name: /^Requests \(/ }).click();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await page.getByRole("button", { name: "Approve request", exact: true }).click();
  session.setRole("participant"); await page.reload();
  await page.getByRole("button", { name: /^Requests \(/ }).click();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await page.getByRole("button", { name: "Schedule in Sprint", exact: true }).click();
  await page.getByLabel(/^Starts \(SF time\)/).fill("2026-11-03T10:00");
  await page.getByLabel(/^Ends \(SF time\)/).fill("2026-11-03T10:30");
  await page.getByRole("button", { name: "Add to Sprint", exact: true }).click();
  await page.goto("/sprint");
  await page.getByRole("button", { name: "Full agenda", exact: true }).click();
  await page.getByRole("button", { name: "View activity Review my portfolio", exact: true }).click();
  await page.getByRole("button", { name: "Update progress", exact: true }).click();
  await page.getByLabel("Activity status", { exact: true }).selectOption("completed");
  await page.getByRole("button", { name: "Save progress", exact: true }).click();
  await page.getByRole("dialog", { name: "Review my portfolio", exact: true }).getByRole("button", { name: "Record outcome", exact: true }).click();
  const outcome = page.getByRole("dialog", { name: "Record outcome", exact: true });
  await outcome.getByLabel(/^What happened/).fill("Improved my portfolio after useful feedback");
  await outcome.getByRole("button", { name: "Save outcome", exact: true }).click();
  await page.goto("/open-doors");
  await page.getByRole("button", { name: /^Requests \(/ }).click();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await page.getByLabel("What happened during this support?", { exact: true }).fill("We reviewed my prototype and improved its story together.");
  await page.getByRole("button", { name: "Report support completed", exact: true }).click();
  session.setRole("organizer"); await page.goto("/organizer");
  await page.getByRole("button", { name: "Manage Test Hustler", exact: true }).click();
  await page.getByRole("menuitem", { name: "Graduate to alumni", exact: true }).click();
  await expect(page.getByText("Alumnus", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View request", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve request", exact: true })).toHaveCount(0);
  await page.getByLabel("Private organizer coordination note", { exact: true }).fill("Follow up on the participant’s next project review.");
  await page.getByRole("button", { name: "Save coordination note", exact: true }).click();
  expect(session.getRequest()?.coordination).toBeTruthy();
  expect(session.writes.some((write) => write.path === "sprint:saveOutcome")).toBe(true);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("alumni offer publishing uses actual introduction paths, and dialogs restore keyboard focus", async ({ page }) => {
  const session = await doorsSession(page); session.setRole("alumnus");
  await page.goto("/open-doors");
  const trigger = page.getByRole("button", { name: "Offer your support", exact: true });
  await trigger.click(); await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("dialog").getByLabel("Support type", { exact: true }).selectOption("introduction");
  await page.getByLabel(/^Offer title/).fill("An introduction to a former teammate");
  await page.getByLabel(/What you can provide/).fill("I can ask a former teammate if they’d like to hear about your project.");
  await page.getByLabel(/Your actual connection and introduction path/).fill("A former teammate building developer tools. I will ask permission before connecting you.");
  await page.getByLabel(/Availability and how to agree a time/).fill("One introduction each month; agree the next step after approval.");
  await page.getByRole("button", { name: "Publish offer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(session.writes.find((write) => write.path === "openDoors:saveOffer")?.args.input).toMatchObject({ kind: "introduction", published: true });
  await page.screenshot({ path: "test-results/open-doors-desktop.png", fullPage: true });
});
