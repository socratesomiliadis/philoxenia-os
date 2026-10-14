import { expect, test } from "@playwright/test";
import { emptyAnswers, templateGoals } from "../../lib/mission";
import { mockSession } from "./helpers/mock-session";

// Exercise the real auth gateway and routes with an isolated, mocked session and
// Convex transport. Backend tests separately verify authorization and completion.
// No test session, account or authentication bypass is added to the application.
test("an invited sign-in provisions the profile, requires onboarding, resumes drafts, and enters Home after confirmation", async ({ page }) => {
  const profile = { _id: "test-profile", _creationTime: 1, authUserId: "test-user", name: "Test Hustler", email: "test@example.com", isAlumni: false, suspended: false };
  const cohort = { _id: "test-cohort", _creationTime: 1, name: "First chapter", description: "", startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "upcoming", createdBy: "test-organizer" };
  let provisioned = false;
  let organizer = false;
  let googleReady = true;
  let onboarding: Record<string, unknown> | null = null;
  let generationCalls = 0;
  let finishGeneration: () => void = () => {};
  const generationReady = new Promise<void>((resolve) => { finishGeneration = resolve; });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockSession(page, {
    user: { id: profile.authUserId, email: profile.email, name: profile.name },
    query: (path) => {
      switch (path) {
        case "auth:readiness": return { google: googleReady };
        case "users:viewer": return { name: profile.name, email: profile.email, profile: provisioned ? profile : null, isOrganizer: organizer, participantCohortIds: provisioned ? [cohort._id] : [], allowed: true, needsProvisioning: !provisioned };
        case "cohorts:list": return [cohort];
        case "onboarding:required": return organizer || onboarding?.confirmedGoals ? null : cohort._id;
        case "onboarding:get": return onboarding;
        default: throw new Error(`Unexpected query in onboarding entry test: ${path}`);
      }
    },
    mutate: (path, args) => {
      if (path === "users:ensureProfile") { provisioned = true; return profile; }
      if (path === "onboarding:saveProposal") {
        const revision = Number(onboarding?.revision ?? 0) + 1;
        onboarding = { ...onboarding, revision, proposal: args.goals, confirmedGoals: args.goals, confirmedAt: Date.now() };
        return revision;
      }
      throw new Error(`Unexpected mutation: ${path}`);
    },
    action: async (path, args) => {
      if (path !== "missions:generate" || args.cohortId !== cohort._id) throw new Error(`Unexpected action: ${path}`);
      generationCalls++;
      await generationReady;
      const goals = templateGoals(answers, cohort.startDate, cohort.endDate);
      const revision = Number(onboarding?.revision ?? 0) + 1;
      onboarding = { ...onboarding, proposal: goals, source: "ai", revision };
      return { goals, source: "ai", revision };
    },
  });

  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "What are you building?" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  expect(provisioned).toBe(true);

  onboarding = { _id: "test-onboarding", _creationTime: 1, profileId: profile._id, cohortId: cohort._id, answers: { ...emptyAnswers, building: "A prototype for game developers.", outcomes: "Find collaborators and get product feedback." }, step: 1, revision: 1, updatedAt: 1 };
  await page.goto("/community");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "What would make SF worthwhile?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your ambitions" })).toHaveValue("Find collaborators and get product feedback.");

  const answers = { building: "A prototype for game developers.", outcomes: "Find collaborators and get product feedback.", industries: ["Developer tools"], offering: "React prototypes and product reviews." };
  onboarding = { ...onboarding, answers, step: 4 };
  await page.reload();
  await expect(page.getByRole("heading", { name: "Creating your mission…" })).toBeVisible();
  expect(generationCalls).toBe(1);
  finishGeneration();
  await expect(page.getByRole("heading", { name: "Your mission, in three goals." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use template goals|Suggest new goals|Create my mission/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your mission, in three goals." })).toBeVisible();
  expect(generationCalls).toBe(1);
  await page.getByRole("button", { name: "Confirm & enter workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Welcome in, Test." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/$/);

  organizer = true;
  onboarding = null;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome in, Test." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Command Center", exact: true })).toBeVisible();
  googleReady = false;
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome, Hustler." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google sign-in is not connected yet" })).toBeDisabled();
  expect(errors).toEqual([]);
});
