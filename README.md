# Philoxenia OS

The workspace for Philoxenia by Hustle Hours: two weeks of building, connecting, and opening doors in San Francisco.

## Stages 1 and 2

Implemented: responsive participant/organizer navigation, Google authentication through Better Auth + Convex, organizer bootstrap, cohort management, approved-email invitations, cohort access controls, participant date overrides, account suspension, and a private community directory. Stage 2 adds resumable onboarding and three editable, measurable mission goals per Hustler and cohort. Opportunity discovery, the Sprint planner, and Open Doors remain clearly labeled placeholders for later stages.

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

Until Google OAuth is configured, development routes show a clearly marked, read-only sample workspace. `/preview` is also available in development; it returns 404 in production. Preview never creates a session or authorizes backend access. Production shows the sign-in screen when configuration is incomplete.

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

## Personal missions

From Home, choose **Set your personal mission**. Four short steps cover a project, SF ambitions, industries, and skills to offer. Answers save after a short pause and when moving between steps. **Save draft** retries a failed save. Use the cohort selector when participating in more than one cohort.

Review exactly three goals, each with a title, numeric target (1–100), a measure, a deadline within the individual stay, and one to three first actions. **Save goal draft** preserves edits without confirming. **Confirm my mission** publishes those goals to your Home dashboard. New suggestions and draft edits leave the confirmed mission in place until **Confirm replacement mission** is selected. Organizers can read onboarding answers and confirmed missions with **View mission** in the cohort roster; other Hustlers cannot read them.

AI is optional. Set these in the selected **Convex deployment’s environment settings** or with `pnpm exec convex env set` in your own terminal:

| Variable | Default / purpose |
| --- | --- |
| `MISSION_AI_PROVIDER` | `groq`; also supports `google` |
| `GROQ_API_KEY` | Required for Groq suggestions |
| `MISSION_AI_MODEL` | `openai/gpt-oss-20b` for Groq; `gemini-2.5-flash-lite` for Google. Override with a model available to your account. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Required when using Google; separate from Google OAuth credentials |

Generation uses the [Vercel AI SDK structured-output API](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) from an authenticated Convex action. Only the four onboarding answers and stay dates go into the prompt. Identity fields, email addresses from the account, and organizer notes are excluded; common email, phone, and URL patterns in answers are redacted. The review screen explains the external request and offers **Use template goals** without contacting a provider. Avoid private details in free text.

Requests are limited transactionally to one per minute and five per hour per profile, across cohorts. Each provider call has a 25-second timeout and no retries. Missing configuration, quota failures, timeout, and malformed or out-of-stay output fall back to labeled, editable template goals. Templates stay available after the generation limit. No automatic paid upgrade is configured; use a provider account with the desired quota/billing settings.

Drafts and missions are owned by the authenticated profile and cohort. Writes require an active membership, including for organizers participating as Hustlers. Access and stay dates are rechecked after generation; stale responses cannot overwrite newer edits or confirmed goals. When an organizer changes stay dates, review existing goal deadlines before confirming another version.

For a development-only interactive sample, visit `/preview/onboarding`. Sample answers stay in the current tab; no AI call, account data, or auth session is created. The route returns 404 in production. Preview behavior is separate from backend persistence, which is covered by authenticated Convex tests.

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Focused backend/date tests cover invitations, provisioning idempotency, organizer authorization, cohort isolation, revoked/unverified/suspended users, privacy, SF daylight-saving dates, draft resumption, mission validation, provider fallback, rate limits, stale generation results, and preservation of confirmed goals. Browser tests cover preview navigation, desktop/mobile onboarding, editable goals, explicit replacement confirmation, and sign-in readiness, with the frontend and configured backend already running:

```powershell
pnpm exec playwright install chromium
pnpm test:ui
```

Set `PLAYWRIGHT_BASE_URL` to use an existing server on another port. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an already installed Chromium binary. No tests create Google accounts or bypass production authentication.

Integration reference: [Convex + Better Auth for Next.js](https://labs.convex.dev/better-auth/framework-guides/next).
