# Philoxenia OS

The workspace for Philoxenia by Hustle Hours: two weeks of building, connecting, and opening doors in San Francisco.

## Stages 1–3

Implemented: responsive participant/organizer navigation, Google authentication through Better Auth + Convex, organizer bootstrap, cohort management, approved-email invitations, cohort access controls, participant date overrides, account suspension, and a private community directory. Stage 2 adds resumable onboarding and three editable, measurable mission goals per Hustler and cohort. Stage 3 adds curated opportunity discovery, explained recommendations, private bookmarks, and organizer publishing. The Sprint planner and Open Doors request workflow remain placeholders for later stages.

Stack: Next.js 16.4, React 19, HeroUI v3, Tailwind v4, Convex, Better Auth, and pnpm. Better Auth is pinned to the version supported by the Convex integration.

## Run locally

```powershell
pnpm install
pnpm dev:backend
```

In another terminal, check whether the Next.js dev server is already running before starting it:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
pnpm dev
```

The backend CLI creates `.env.local`. `NEXT_PUBLIC_CONVEX_SITE_URL` must be the deployment's HTTP actions URL (`.convex.site` for cloud, port 3211 for local), while `NEXT_PUBLIC_CONVEX_URL` is the client URL (`.convex.cloud` for cloud, port 3210 for local).

For this initial build, an anonymous local Convex deployment was initialized and the backend organizer allowlist was set to `s.omiliadis@gmail.com`. No cloud project or Google OAuth client was created. The local backend authentication secret has already been generated securely; it is not committed.

Until Google OAuth is configured, development routes show a clearly marked sample workspace. Onboarding and opportunity previews allow local-only interactions; organizer writes are disabled. `/preview` is also available in development; it returns 404 in production. Preview never creates a session or authorizes backend access. Production shows the sign-in screen when configuration is incomplete.

## Connect Convex and Google

1. Create an account/project at [Convex](https://dashboard.convex.dev/). Run `pnpm exec convex login`, then `pnpm exec convex dev --configure existing` to select that project. Use the CLI's resulting `.env.local` URLs. Switching to cloud does not migrate local data automatically.
2. Create a **Web application** OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Configure the consent screen and add your testing accounts while the OAuth app is in testing.
3. Set the authorized JavaScript origin to `http://localhost:3000` and the authorized redirect URI to `http://localhost:3000/api/auth/callback/google`. For production, add the equivalents using the deployed app's exact HTTPS origin.
4. In your selected **Convex deployment's environment settings**, add:

   | Variable | Value |
   | --- | --- |
   | `SITE_URL` | `http://localhost:3000`, or your production app origin |
   | `BETTER_AUTH_SECRET` | A securely generated random secret of at least 32 characters |
   | `GOOGLE_CLIENT_ID` | The Google Web application client ID |
   | `GOOGLE_CLIENT_SECRET` | Its client secret |
   | `ORGANIZER_EMAILS` | `s.omiliadis@gmail.com` |

   For the initialized local deployment, `SITE_URL`, `BETTER_AUTH_SECRET`, and `ORGANIZER_EMAILS` are already set. Add the two Google variables using `pnpm exec convex env set` in your own terminal. Keep credentials in environment settings, never source files.
5. Run `pnpm dev:backend` and reuse/restart the frontend as needed after environment changes. Visit `/sign-in` and sign in as `s.omiliadis@gmail.com`.
6. Open **Command Center → New cohort**, set its name and arrival date, then use **Invite Hustler** with the participant's Google email. Copy and share the sign-in link. The verified account joins the assigned cohort on first sign-in.

Add a second organizer later by changing `ORGANIZER_EMAILS` to a comma-separated list on the backend. Organizer privileges are never chosen in the browser. An organizer must have a verified Google email and a provisioned profile.

Invitation emails are scheduled for the Open Doors/email stage. Stage 1 saves approved invitations and gives organizers a shareable sign-in link; it does not deliver email.

## Access and dates

- Every protected Convex query and mutation checks authentication and active membership or organizer privileges. A Google account alone does not grant application access.
- Organizers can see cohorts, rosters, and invitation emails. Hustlers can see only their own cohorts and the community's public profile fields. The community query excludes email addresses.
- Revoking an invitation blocks joining through it. Revoking a membership removes that cohort's access. Suspending a participant blocks all workspace access until restored. Restoring an invitation/membership does not silently remove a suspension.
- Cohort dates are ISO calendar dates in `America/Los_Angeles`. The end date is arrival plus 13 calendar days (14 days inclusive), including across daylight-saving transitions. Optional participant arrival overrides use the same rule.
- A completed cohort remains visible to its members; becoming an alumnus is a separate later-stage organizer action.
- To reset a test account, open **Command Center → participant’s Manage button → Delete user**. Type the displayed email and choose **Delete user permanently**. This deletes the Philoxenia profile, all cohort memberships and invitations, onboarding/mission data, generation limits, Better Auth user, linked sign-in records, and sessions. Cohorts and other users remain intact. Organizer accounts cannot be deleted. Use **Invite Hustler** with the same email afterward; the next Google sign-in creates a fresh profile and starts onboarding. This removes the app’s sign-in record, not the external Google account.

## Personal missions

After Google sign-in and invitation acceptance, Hustlers automatically enter `/onboarding` before the workspace opens. This also catches already provisioned accounts with incomplete onboarding on refresh. Four short steps cover a project, SF ambitions, industries, and skills to offer, using the same photo, split layout, and card styling as sign-in. Answers save after a short pause and when moving between steps; refreshing or signing back in resumes the draft. **Retry save** appears only if autosave fails. **Confirm & enter workspace** saves the mission and opens Home.

The entry gate requires a confirmed mission for each active or upcoming cohort membership, prioritizing active cohorts and then the nearest arrival. Saved answers and generated suggestions alone do not complete onboarding. Organizers can always enter the Command Center; completed cohorts do not force historical onboarding. After onboarding, use **Review your mission** on Home to refine goals or switch cohorts.

Continuing from the fourth answer automatically calls AI mission generation. There are no AI/template selection buttons. The final step shows all three goal summaries in one card; open a goal to edit its title, numeric target (1–100), measure, deadline within the individual stay, or first actions. Only one editor opens at a time. Saved suggestions are restored on reload without another AI request; an unfinished review with no suggestions starts generation automatically. Use **Edit answers** to revise the answers and create fresh suggestions after the fourth step.

**Save goal draft** appears when goals have been edited and preserves those edits without confirming. **Confirm my mission** publishes the goals to Home; new Hustlers use **Confirm & enter workspace**. New suggestions and draft edits leave the confirmed mission in place until **Confirm replacement mission** is selected. Organizers can read onboarding answers and confirmed missions with **View mission** in the cohort roster; other Hustlers cannot read them.

AI is optional. Set these in the selected **Convex deployment’s environment settings** or with `pnpm exec convex env set` in your own terminal:

| Variable | Default / purpose |
| --- | --- |
| `MISSION_AI_PROVIDER` | `groq`; also supports `google` |
| `GROQ_API_KEY` | Required for Groq suggestions |
| `MISSION_AI_MODEL` | `openai/gpt-oss-20b` for Groq; `gemini-2.5-flash-lite` for Google. Override with a model available to your account. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Required when using Google; separate from Google OAuth credentials |

Generation uses the [Vercel AI SDK structured-output API](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) from an authenticated Convex action. Only the four onboarding answers and stay dates go into the prompt. Identity fields, email addresses from the account, and organizer notes are excluded; common email, phone, and URL patterns in answers are redacted. Avoid private details in free text.

Requests are limited transactionally to one per minute and five per hour per profile, across cohorts. Each provider call has a 25-second timeout and no retries. Missing configuration, quota failures, timeout, and malformed or out-of-stay output fall back automatically to labeled, editable starter goals. Rate-limit errors offer a retry without replacing saved goals. No automatic paid upgrade is configured; use a provider account with the desired quota/billing settings.

Drafts and missions are owned by the authenticated profile and cohort. Writes require an active membership, including for organizers participating as Hustlers. Access and stay dates are rechecked after generation; stale responses cannot overwrite newer edits or confirmed goals. When an organizer changes stay dates, review existing goal deadlines before confirming another version.

For a development-only interactive sample, visit `/preview/onboarding`. Sample answers stay in the current tab; no AI call, account data, or auth session is created. The route returns 404 in production. Preview behavior is separate from backend persistence, which is covered by authenticated Convex tests.

## Curated opportunities

Open **Opportunities** to search events, startups, founders, and alumni offers. San Francisco is the default location; **Filters** includes the wider Bay Area (including SF), online, interests, event dates, and event cost. “Price not confirmed” is distinct from free. Event date and cost filters apply only to events; directories and offers remain visible. Event times display in San Francisco time, including the correct PST/PDT offset. Registration stays on the original platform.

Recommendations use the selected cohort’s onboarding interests, categories inferred from its confirmed mission, individual stay dates, and organizer picks. Draft goal proposals are excluded. Listings explain the actual matching reasons in **View details**. No model or third-party service receives mission data for ranking. Members without a current cohort can still browse and bookmark the shared catalog.

Bookmarks belong to the signed-in member across cohorts and survive refresh. **Saved** respects the current filters, including location. Archiving or reverting a listing to draft hides it from members while retaining bookmarks for a later republication. Deleting a participant also removes their bookmarks.

In **Command Center → Manage opportunities**, use **Add opportunity** to save a draft or publish a listing. Required fields include the original source, location, interests, and details. Events also require a start time entered in SF time and a cost status. Organizers can edit, archive, or republish; conflicting edits require reopening the editor. Entries of the same type and canonical source URL are deduplicated, including tracking links. Drafts and archives are organizer-only; published listings are visible to approved members across cohorts.

Founder and startup listings are public directory entries and do not imply an introduction, meeting, or visit. Alumni offers require a named provider, a specific support/request path, availability or capacity, and a request URL. Publishing requires the organizer to explicitly confirm the alumnus agreed to those details. Requests use that external path in Stage 3; the in-app approval and introduction workflow arrives in Stage 5.

**Add curated starters** adds four real directory drafts without overwriting existing curation: [LangChain and Harrison Chase](https://www.langchain.com/about), [Supabase](https://www.ycombinator.com/companies/supabase/jobs), and [Replit](https://replit.com/careers). Primary sources were reviewed October 14, 2026; organizers should review current details before publishing. No live events or alumni availability are invented. The pilot catalog starts empty until an organizer publishes real entries. Automated event ingestion is Stage 6.

For development, `/preview/opportunities` contains labeled illustrative events, companies, founders, and offers. Search, filtering, details, and temporary bookmarks work without an account; preview changes reset on leaving the page and never reach Convex. Organizer writes remain disabled in preview, and all preview routes return 404 in production. No production sample seed is run automatically. The catalog query uses indexed publication and bookmark reads and returns the small curated pilot catalog in one subscription; paginate/search server-side before expanding to automated feeds.

Stage 3 backend checks cover publication visibility, organizer authorization, revoked/unverified/suspended members, bookmark isolation and deletion, cohort-specific recommendations, confirmed support paths, source deduplication, concurrent edits, idempotent curation, and SF date boundaries. Browser checks cover discovery on desktop/mobile, keyboard dismissal and focus restoration, authenticated bookmark retry/persistence, and organizer draft-to-publish-to-archive flows. Authenticated browser transport is isolated and mocked; backend authorization is exercised by Convex tests.

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Focused backend/date tests cover invitations, provisioning idempotency, organizer authorization, cohort isolation, revoked/unverified/suspended users, privacy, SF daylight-saving dates, onboarding completion requirements, draft resumption, mission validation, provider fallback, rate limits, stale generation results, and preservation of confirmed goals. Browser tests cover preview navigation, desktop/mobile onboarding, editable goals, explicit replacement confirmation, and sign-in readiness. A separate browser regression uses isolated mocked authentication and Convex responses to exercise the real sign-in gateway: invitation provisioning, automatic onboarding, deep-link interception, draft resumption, confirmation-to-Home, returning users, and organizer access. These mocks never reach the real backend. Run with the frontend and configured backend already running:

```powershell
pnpm exec playwright install chromium
pnpm test:ui
```

Set `PLAYWRIGHT_BASE_URL` to use an existing server on another port. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an already installed Chromium binary. No tests create Google accounts or bypass production authentication.

Integration reference: [Convex + Better Auth for Next.js](https://labs.convex.dev/better-auth/framework-guides/next).
