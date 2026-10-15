// Run against an existing local dev server: node scripts/capture-readme-screenshots.mjs
// All account and application data is intercepted in the browser; nothing is seeded remotely.
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { mockSession } from "../tests/browser/helpers/mock-session.ts";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("Capture screenshots against a local development server.");
}
const output = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
await mkdir(output, { recursive: true });
const now = Date.parse("2026-11-05T17:00:00Z");
const confirmedAt = Date.parse("2026-11-01T18:00:00Z");
const cohort = { _id: "demo-cohort", _creationTime: confirmedAt, name: "November 2026 · Builders in SF", description: "Fourteen days to test ideas, meet your people, and build something useful.", startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "active", createdBy: "demo-organizer" };
const goals = [
  { title: "Validate Relay with real teams", target: 5, metric: "product feedback conversations", deadline: "2026-11-13", firstActions: ["Prepare a five-minute walkthrough of Relay.", "Invite two developer teams to try the prototype."] },
  { title: "Find my developer tools community", target: 3, metric: "founder and developer meetups", deadline: "2026-11-15", firstActions: ["Bookmark relevant Bay Area events.", "Follow up with one builder after each meetup."] },
  { title: "Help another builder ship", target: 2, metric: "peer product reviews", deadline: "2026-11-14", firstActions: ["Offer a React and UX review to the cohort.", "Share actionable feedback and a working example."] },
];
const answers = { building: "Relay helps small developer teams turn scattered customer feedback into a clear product roadmap. I have a working prototype and want to test it with early users.", outcomes: "Get feedback from five potential users, meet other developer tools founders, and leave with a clearer first release.", industries: ["Developer tools", "AI & machine learning"], offering: "React prototypes, usability reviews, and a fresh perspective on onboarding." };
const people = [
  ["eleni", "Eleni Markou", false, "Product engineer · Building Relay", "Athens, Greece", "Turning customer feedback into a clearer product roadmap for small developer teams.", "Relay · Customer feedback for developer teams", "Developer tools, AI & machine learning", "React prototypes and onboarding reviews"],
  ["nikos", "Nikos Andreou", false, "Founder · Making energy data useful", "Thessaloniki, Greece", "Building practical tools that help small businesses understand and reduce their energy use.", "Wattwise · Energy insights for small businesses", "Climate & energy, AI & machine learning", "Data analysis and Python prototypes"],
  ["maya", "Maya Chen", true, "Product designer · Philoxenia alumna", "San Francisco, CA", "I help early-stage teams make complex products feel simple. Happy to share what I learned from my own first launch.", "Design systems for growing product teams", "Creative tools, Developer tools", "Portfolio reviews and product storytelling"],
  ["sofia", "Sofia Petrou", false, "Designer & founder · Building Gather", "Patras, Greece", "Exploring how neighborhood communities can share skills and make it easier to meet in person.", "Gather · Neighborhood skill exchanges", "Consumer & community, Creative tools", "Brand strategy and landing page feedback"],
  ["daniel", "Daniel Reyes", true, "Developer tools founder · Philoxenia alumnus", "San Francisco, CA", "From first prototype to first paying customer. I enjoy helping builders ask better questions and find their early users.", "Developer workflows for small engineering teams", "Developer tools, Startups", "Founder mentoring and focused introductions"],
  ["andreas", "Andreas Nikolaou", false, "ML engineer · Building Fieldwork", "Athens, Greece", "Making machine learning experiments easier to reproduce. Looking for collaborators who care about good developer experiences.", "Fieldwork · Reproducible ML experiments", "AI & machine learning, Developer tools", "Model evaluation and Python tooling"],
].map(([id, name, isAlumni, headline, location, bio, building, interests, offering]) => ({
  _id: `demo-${id}`, _creationTime: confirmedAt, authUserId: `demo-auth-${id}`, name, email: `${id}@example.com`, isAlumni, isOrganizer: false, suspended: false,
  community: { headline, location, bio, building, interests, offering, socialLinks: {} },
  cohorts: [{ name: isAlumni ? "Summer 2026 · First connections" : cohort.name, status: isAlumni ? "completed" : "active" }],
}));
const profile = people[0];
const organizerProfile = { _id: "demo-organizer", _creationTime: confirmedAt, authUserId: "demo-auth-organizer", name: "Anna Dimitriou", email: "anna@example.com", isAlumni: false, suspended: false };
const sf = (day, time) => Date.parse(`2026-11-${day}T${time}:00-08:00`);
function entry(id, title, day, start, end, options = {}) {
  const { goal = 0, contribution = 0, completed = false, ...rest } = options;
  return { _id: id, title, kind: "meeting", scope: "personal", notes: "", location: "San Francisco", revision: 1, updatedAt: now,
    ...(start ? { startAt: sf(day, start), endAt: sf(day, end) } : { day: `2026-11-${day}` }),
    calendarUid: `${id}@example.com`, ...rest,
    progress: { status: completed ? "completed" : "planned", contribution, goalLink: { missionConfirmedAt: confirmedAt, index: goal }, revision: 1, activityRevision: 1, updatedAt: now, ...(completed ? { completedAt: sf(day, end ?? "17:00") } : {}) },
  };
}
const entries = [
  entry("demo-welcome", "Cohort breakfast & first introductions", "02", "09:30", "10:30", { scope: "cohort", location: "Philoxenia house · SoMa", completed: true, goal: 1 }),
  entry("demo-feedback-1", "Relay feedback with a two-person dev team", "03", "11:00", "11:45", { location: "Sightglass Coffee · SoMa", completed: true, contribution: 1 }),
  entry("demo-feedback-2", "Walk through Relay with an early user", "04", "10:00", "10:30", { location: "Mission District", completed: true, contribution: 1 }),
  entry("demo-review", "Review Sofia’s Gather onboarding", "04", "14:00", "14:45", { location: "Philoxenia house · SoMa", completed: true, goal: 2, contribution: 1 }),
  entry("demo-meetup", "Developer tools founders meetup", "04", "18:00", "20:00", { kind: "event", location: "SoMa · San Francisco", completed: true, goal: 1, contribution: 1 }),
  entry("demo-focus", "Ship the new feedback inbox", "05", "09:30", "11:00", { kind: "task", location: "Philoxenia house · SoMa", notes: "Apply yesterday’s feedback: simplify the first-run experience and add quick tagging." }),
  entry("demo-coffee", "Product feedback coffee with Daniel", "05", "11:30", "12:15", { location: "Sightglass Coffee · SoMa", notes: "Walk through the Relay prototype and learn how Daniel found his first ten users." }),
  entry("demo-studio", "Cohort build session & demo circle", "05", "14:00", "16:00", { scope: "cohort", kind: "challenge", location: "Philoxenia house · SoMa", goal: 2, notes: "Build together, show one improvement, and give a fellow builder specific feedback." }),
  entry("demo-ai-evening", "AI builders: from prototype to product", "05", "18:00", "20:00", { kind: "event", location: "Mission Bay · San Francisco", goal: 1 }),
  entry("demo-portfolio", "Portfolio and product story with Maya", "06", "10:30", "11:00", { location: "Hayes Valley · San Francisco", goal: 2 }),
  entry("demo-workshop", "Finding your first ten users", "07", "13:00", "15:00", { kind: "event", location: "Mission District · San Francisco", goal: 1 }),
  entry("demo-demo-day", "Cohort demo night", "13", "17:00", "19:00", { kind: "event", scope: "cohort", location: "Philoxenia house · SoMa", goal: 1 }),
];
const outcomes = [
  { _id: "demo-outcome-1", type: "feedback", title: "Two teams helped simplify Relay’s onboarding", date: "2026-11-04", quantity: 2, notes: "Both wanted to see their first feedback item before configuring a workspace. Moving that step earlier in the next release.", activityId: "demo-feedback-2", updatedAt: now },
  { _id: "demo-outcome-2", type: "project", title: "A clearer first-run experience for Gather", date: "2026-11-04", quantity: 1, notes: "Worked with Sofia to shorten signup and make the first skill exchange easier to discover.", activityId: "demo-review", updatedAt: now },
];
const sprint = { cohortId: cohort._id, cohortName: cohort.name, startDate: cohort.startDate, endDate: cohort.endDate, canPlan: true, readOnly: false, management: false, missionConfirmedAt: confirmedAt, goals, entries, outcomes };
const opportunities = [
  ["event", "AI builders: from prototype to product", "Share a working demo, compare notes with other builders, and get useful feedback on your next release.", "Mission Bay · San Francisco", ["AI & machine learning", "Developer tools"], "05", "18:00", "20:00", "free"],
  ["event", "Finding your first ten users", "A practical workshop on early customer conversations, outreach, and turning feedback into a focused product.", "Mission District · San Francisco", ["Developer tools", "Consumer & community"], "07", "13:00", "15:00", "paid"],
  ["event", "Climate founders coffee", "Meet founders working on energy and climate products over a small-group morning coffee.", "Hayes Valley · San Francisco", ["Climate & energy"], "09", "09:00", "10:30", "free"],
  ["startup", "Stacklane", "Developer infrastructure that gives small engineering teams more time to build their core product.", "SoMa · San Francisco", ["Developer tools"]],
  ["founder", "Alex Rivera · Northstar", "A founder building better research workflows for product teams. Explore their work and public profile.", "San Francisco", ["Developer tools", "AI & machine learning"]],
  ["event", "Designing a product people come back to", "An evening of product teardowns and honest lessons from building a first customer experience.", "SoMa · San Francisco", ["Creative tools", "Developer tools"], "10", "17:30", "19:30", "free"],
].map(([kind, title, summary, location, interests, day, start, end, cost], index) => ({
  _id: `demo-opportunity-${index}`, kind, title, summary, description: summary, location, interests, categories: index === 1 ? ["learn", "feedback"] : ["connect", "feedback"], area: "sf", status: "published", organizerPick: index === 0 || index === 3, sourceName: kind === "event" ? "Luma" : "Organizer curation", sourceUrl: `https://example.com/opportunities/${index}`, saved: index === 0 || index === 1, updatedAt: now,
  ...(index === 0 ? { imageUrl: "/images/san-francisco-golden-gate.jpg" } : {}),
  ...(day ? { startAt: sf(day, start), endAt: sf(day, end), cost, ...(cost === "paid" ? { costNote: "$20 · workshop materials included" } : {}) } : {}),
}));
const offers = [
  { _id: "demo-offer-maya", ownerId: "demo-maya", ownerName: "Maya Chen", kind: "portfolio", title: "Tell a clearer product story", description: "Bring your landing page or portfolio and one question. We’ll work through how you explain the problem, show your work, and make your next step clear.", availability: "Two 30-minute sessions during the November cohort. Weekday mornings, Pacific Time.", capacity: 3, remaining: 2, connection: "" },
  { _id: "demo-offer-daniel", ownerId: "demo-daniel", ownerName: "Daniel Reyes", kind: "mentorship", title: "From first demo to first users", description: "A focused conversation about finding early users for a developer tool. Bring a working demo and the questions you’re hearing from potential customers.", availability: "One 45-minute coffee each week in SoMa. Agree a time together before scheduling.", capacity: 2, remaining: 1, connection: "" },
  { _id: "demo-offer-intro", ownerId: "demo-daniel", ownerName: "Daniel Reyes", kind: "introduction", title: "Meet another developer tools founder", description: "Share a short description of your project and who you would like to learn from. I can ask a founder in my network whether an introduction would be useful.", availability: "One introduction during the cohort, subject to their agreement.", capacity: 1, remaining: 1, connection: "A former teammate now runs a developer tools company. I’ll ask for their permission before making a personal introduction." },
].map((offer) => ({ ...offer, _creationTime: confirmedAt, published: true, own: false, revision: 1, updatedAt: now }));
const requests = [{ _id: "demo-request", _creationTime: confirmedAt, offerId: offers[1]._id, requesterId: profile._id, alumnusId: "demo-daniel", cohortId: cohort._id, goal: "Get feedback on Relay’s first-run experience and choose a practical way to find our first five teams.", fit: "Relay is a working developer tools prototype. Daniel’s experience finding early customers is directly relevant to my mission.", offerSnapshot: offers[1], status: "agreed", response: "Let’s walk through your prototype over coffee on Thursday. Bring the questions from your first two user conversations.", revision: 1, updatedAt: now, requesterName: profile.name, alumnusName: "Daniel Reyes", isRequester: true, isRecipient: false, coordination: null, activityId: "demo-coffee", meeting: { title: entries[6].title, startAt: entries[6].startAt, endAt: entries[6].endAt }, outcomeCount: 0 }];
const reportParticipants = people.filter((person) => !person.isAlumni).map((person, index) => ({
  profileId: person._id, name: person.name, email: person.email, membershipStatus: "active", suspended: false, alumni: false, startDate: cohort.startDate, endDate: cohort.endDate,
  goals: index === 3 ? [] : goals, totals: index === 0 ? [2, 1, 1] : [1, 1, 0], confirmedAt: index === 3 ? undefined : confirmedAt,
  entries: entries.map((activity) => ({ ...activity, id: activity._id, status: activity.progress.status })), outcomes: index === 0 ? outcomes : [],
  flags: index === 1 ? [{ reason: "Asked for help finding founders working on climate and energy." }] : index === 2 ? [{ reason: "Support request has been awaiting a reply for more than 48 hours." }] : index === 3 ? [{ reason: "Personal mission is not confirmed for this active cohort." }] : [],
  checkin: index === 1 ? { _id: "demo-checkin", status: "open", revision: 1, message: "I’d love help finding two climate founders to speak with about Wattwise." } : null, note: null,
}));

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : { channel: "chrome" });
try {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "reduce", timezoneId: "America/Los_Angeles", locale: "en-US", colorScheme: "light" });
  // Block backend HTTP as well as intercepting auth and the Convex WebSocket transport.
  await context.route(/https?:\/\/[^/]+\.convex\.(cloud|site)\//, (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date(now));
  let organizer = false;
  await mockSession(page, {
    user: { id: profile.authUserId, name: profile.name, email: profile.email },
    query(path, args) {
      switch (path) {
        case "auth:readiness": return { google: true, emailAndPassword: true };
        case "users:viewer": { const current = organizer ? organizerProfile : profile; return { name: current.name, email: current.email, profile: current, isOrganizer: organizer, participantCohortIds: organizer ? [] : [cohort._id], allowed: true, needsProvisioning: false }; }
        case "cohorts:list": return [cohort];
        case "onboarding:required": return null;
        case "onboarding:get": return { _id: "demo-onboarding", _creationTime: confirmedAt, cohortId: cohort._id, profileId: profile._id, answers, step: 4, revision: 1, confirmedGoals: goals, confirmedAt, startDate: cohort.startDate, endDate: cohort.endDate };
        case "sprint:get": return sprint;
        case "sprint:shared": return { ...sprint, management: true, entries: entries.filter((activity) => activity.scope === "cohort"), outcomes: [], goals: [] };
        case "opportunities:list": return { entries: opportunities, context: { interests: answers.industries, categories: ["connect", "feedback"], startDate: cohort.startDate, endDate: cohort.endDate } };
        case "users:community": return people;
        case "openDoors:catalog": return offers;
        case "openDoors:ownOffers": return [];
        case "openDoors:requests": return requests;
        case "cohorts:roster": return { participants: people.filter((person) => !person.isAlumni).map((person, index) => ({ _id: `demo-membership-${index}`, _creationTime: confirmedAt, cohortId: cohort._id, profileId: person._id, status: "active", profile: person, isOrganizer: false })), invitations: [{ _id: "demo-invite", _creationTime: now, name: "Christina Pappas", email: "christina@example.com", status: "pending", cohortId: cohort._id }] };
        case "cohorts:overview": return { cohorts: 1, participants: 4, pendingInvitations: 1 };
        case "commandCenter:cohortSummary": return { cohort, asOf: now, participants: reportParticipants, summary: { active: 4, onboardingIncomplete: 1, needingAttention: 3, openCheckins: 1, plannedMeetings: 8, completedActivities: 12, reportedOutcomes: 5, pendingRequests: 1, pendingInvitations: 1 } };
        case "commandCenter:operations": return null;
        case "commandCenter:ownCheckin": return null;
        case "notifications:inbox": case "notifications:deliveries": return [];
        default: throw new Error(`Unconfigured screenshot query: ${path} ${JSON.stringify(args)}`);
      }
    },
    mutate(path) { throw new Error(`Screenshots never write application data: ${path}`); },
  });

  async function capture(name, route, ready, setup) {
    await page.setViewportSize(name === "opportunities" ? { width: 1600, height: 1160 } : { width: 1440, height: name === "sprint" ? 1280 : 1080 });
    await page.goto(route);
    await expect(page.getByRole("heading", { name: ready, exact: true })).toBeVisible();
    if (setup) await setup();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    });
    await expect(page.getByRole("region", { name: "Workspace content", exact: true })).toBeVisible();
    expect(await page.getByRole("region", { name: "Workspace content", exact: true }).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `${output}${name}.png`, animations: "disabled" });
    console.log(`Captured ${name}`);
  }
  await capture("mission", "/", "Welcome in, Eleni.", async () => {
    await expect(page.getByText("Day 4 of 14", { exact: true })).toBeVisible();
    await expect(page.getByText(goals[0].title, { exact: true })).toBeVisible();
  });
  await capture("opportunities", "/opportunities", "Opportunities", async () => { await expect(page.getByRole("article")).toHaveCount(6); });
  await capture("sprint", "/sprint", "Your 14-day Sprint", async () => {
    await page.getByRole("button", { name: "Day 4, Nov 5", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Thursday, Nov 5", exact: true })).toBeVisible();
  });
  await capture("community", "/community", "Your kind of people.", async () => { await expect(page.getByText("6 members across the community", { exact: true })).toBeVisible(); });
  await capture("open-doors", "/open-doors", "Open Doors", async () => { await expect(page.getByRole("heading", { name: offers[0].title, exact: true })).toBeVisible(); });
  organizer = true;
  await capture("command-center", "/organizer", "Command Center", async () => { await expect(page.getByRole("heading", { name: "Follow-ups", exact: true })).toBeVisible(); });
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
