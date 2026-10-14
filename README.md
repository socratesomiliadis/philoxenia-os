# Philoxenia OS

The workspace for Philoxenia by Hustle Hours: two weeks of building, connecting, and opening doors in San Francisco.

## Stage 1

Implemented: responsive participant/organizer navigation, Google authentication through Better Auth + Convex, organizer bootstrap, cohort management, approved-email invitations, cohort access controls, participant date overrides, account suspension, and a private community directory. Onboarding, opportunity discovery, the Sprint planner, and Open Doors have clearly labeled placeholders for later stages.

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

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Three focused backend/date tests cover invitations, provisioning idempotency, organizer authorization, cohort isolation, revoked/unverified/suspended users, privacy, and SF daylight-saving dates. The browser smoke test checks development preview navigation, mobile overflow, and unavailable Google sign-in, with both frontend and backend already running and Google credentials unset:

```powershell
pnpm exec playwright install chromium
pnpm test:ui
```

Set `PLAYWRIGHT_BASE_URL` to use an existing server on another port. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an already installed Chromium binary. No tests create Google accounts or bypass production authentication.

Integration reference: [Convex + Better Auth for Next.js](https://labs.convex.dev/better-auth/framework-guides/next).
