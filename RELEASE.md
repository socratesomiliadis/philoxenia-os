# Pilot release

Target frontend: **https://philoxenia-os.vercel.app**. Stage 7 code is implemented; production activation remains pending. The Convex production deployment, production OAuth/email settings, and second organizer are not set up yet. A successful local build or mocked browser rehearsal does not satisfy the production pilot acceptance criteria.

## Keep environments separate

| Environment | Frontend | Backend and secrets |
| --- | --- | --- |
| Development | localhost:3000 | Existing development deployment and `.env.local`; keep existing settings intact |
| Production | philoxenia-os.vercel.app | New Convex production deployment, new auth secret, production OAuth and Resend configuration |
| Vercel Preview | Preview URLs | Separate non-production backend only; never expose the production deploy key to Preview |

Do not copy participant data, Google sessions, or provider credentials into samples. Development `/preview` routes return 404 in a production build. Vercel Preview also runs a production build; sample routes are unavailable there. The app advertises `noindex` and disallows crawling; authorization remains enforced by Convex.

## Configure the production backend

1. Create/select the Convex project and create its production deployment in the dashboard. Keep local `.env.local` pointing at development. Production starts with an empty database; development data is not migrated automatically.
2. Configure these in the **production deployment's** environment settings:

   | Variable | Production value |
   | --- | --- |
   | `SITE_URL` | `https://philoxenia-os.vercel.app` (no trailing slash) |
   | `BETTER_AUTH_SECRET` | New securely generated random secret, at least 32 characters; different from development |
   | `GOOGLE_CLIENT_ID` | Production Google Web OAuth client |
   | `GOOGLE_CLIENT_SECRET` | Its secret |
   | `ORGANIZER_EMAILS` | `s.omiliadis@gmail.com,<second-organizer-google-email>`; replace the placeholder before saving |
   | `RESEND_API_KEY` | Production Resend sending key |
   | `EMAIL_FROM` | Sender on a domain verified in Resend |

3. Configure optional mission AI and SerpApi variables from `.env.example` on production only if needed. Missions have an editable fallback. Event sources start disabled; enable bounded imports deliberately after the cohort is ready.
4. Create a Google Web OAuth client with authorized JavaScript origin `https://philoxenia-os.vercel.app` and redirect URI `https://philoxenia-os.vercel.app/api/auth/callback/google`. Configure the consent screen and audience/test users for both organizers and invited pilot accounts. Preserve the development client's localhost configuration.
5. Verify the sender domain in Resend before sending invitations. Confirm provider account limits and test one delivery to a controlled address. The operations panel checks credential presence, not provider verification.

## Configure Vercel Production

Use the existing Vercel project serving `philoxenia-os.vercel.app`, Next.js framework preset, and `pnpm install --frozen-lockfile` for installation.

Generate a **production deployment key** with deployment permission in Convex. Set `CONVEX_DEPLOY_KEY` in Vercel scoped to **Production only**. Keep it out of the repository, chat, browser, and Vercel Preview environment. Remove any stale Production `CONVEX_DEPLOYMENT` value pointing at development.

Override the **Production build command** to:

```text
pnpm build:release
```

This runs Convex deployment with the target's URL injected into the frontend build, checks that the key and Vercel environment are production, derives the matching `.convex.site` auth URL, and builds Next.js. If `NEXT_PUBLIC_CONVEX_SITE_URL` is set in Vercel, it must match the selected deployment. `NEXT_PUBLIC_CONVEX_URL` is supplied by the release command. Never put OAuth, Resend, AI, or SerpApi secrets in `NEXT_PUBLIC_` variables.

Use `pnpm build` for local builds and separately configured Preview builds, with both public Convex URLs set to a non-production deployment. Keep Preview deployments protected and do not reuse production OAuth or email credentials. Per-branch Convex preview provisioning is optional and has not been configured by this stage.

The release command performs the frontend build before publishing Convex functions. If the build or backend deployment fails, stop the frontend release and inspect Vercel build logs. After a successful release, verify the deployed commit and both public backend URLs in the build configuration.

Official references: [Convex on Vercel](https://docs.convex.dev/production/hosting/vercel), [Convex deploy command](https://docs.convex.dev/cli/reference/deploy), [Better Auth + Next.js](https://labs.convex.dev/better-auth/framework-guides/next).

## Pilot rehearsal and handover

Complete these on production using controlled invited accounts before inviting the pilot. Record the date, deployment/commit, tester, and result; keep account details and private data out of the repository.

1. Both organizers sign in with verified Google accounts and independently open Command Center. Check **Pilot operations** for two provisioned organizers, HTTPS origin, OAuth and email configuration. Credential flags alone do not establish readiness.
2. Create a cohort and invite a Hustler. Verify the invitation email and sign-in link, resumable onboarding, editable mission confirmation, and fallback if AI is unavailable. Confirm uninvited and revoked accounts cannot enter.
3. During onboarding, submit **I need help**. Verify organizers see the message and explained flag, save a private follow-up note, and resolve the check-in. Confirm another participant cannot read the help message or organizer note.
4. Publish an opportunity, bookmark it, schedule it in Sprint, handle an overlap, and export an ICS. Add a shared activity. Mark an activity completed and record a separate self-reported outcome. Check the cohort summary and each CSV; distinguish planned, marked completed, and self-reported values.
5. Graduate a controlled completed-cohort member, publish an alumni offer with a real introduction path, submit a request, propose and accept an alternative, agree a time, schedule it, and report attendance/outcomes separately. Have the other organizer review assignment and private coordination. Test an unanswered request after 48 hours or use a controlled backend fixture outside production; never modify real timestamps to force a flag.
6. Rehearse mobile navigation and help forms at 320px, keyboard focus/Escape, and one retry after a failed request. Confirm private notes and help text are excluded from CSVs. Delete the controlled test participant if appropriate.
7. Check import status and email delivery errors. A failed email must leave the underlying invitation/request saved. Retry a controlled failed/disabled delivery only within the documented retry window. Verify actual delivery and OAuth callbacks.

## Operating the pilot

**Command Center → Cohort support & results** defaults to participants needing attention. Reasons are explicit help, missing confirmed missions in upcoming/active cohorts, pending support requests older than 48 hours, and past-due goals with insufficient current-mission contributions. SF calendar dates define overdue status; a goal is not overdue on its deadline. Revoked/suspended participants remain reviewable and exportable but are excluded from active attention flags and headline counts. Completed cohorts retain historical goals/results; incomplete onboarding no longer raises an attention flag there.

Use **Refresh status** when checking time-based flags. Queries update on database changes; elapsed time alone does not trigger a Convex subscription. Each report displays its snapshot time. Participation/result metrics count active unsuspended members; pending request/invitation totals cover the whole selected cohort. Exports include every membership in the selected cohort. Shared activities count per participant. Outcomes count records, with their separate quantities in the detailed export. The latest check-in per person/cohort is retained; sending a new check-in after resolution replaces its message and reopens it.

Private notes record their last author and reject conflicting edits. Open Doors coordination continues to assign the saving organizer, now displaying the coordinator's name to organizers. Private note content and help messages are not included in the four CSV exports. Downloads contain personal data and should be shared only with cohort operators.

The pilot query uses indexed per-cohort/per-person reads and a complete subscription. Add pagination before expanding beyond the small pilot. It is not a cross-cohort analytics warehouse.

Runtime failures are visible in **Convex deployment logs** and **Vercel runtime/build logs**. The in-app operations panel reports recent failed/disabled emails (latest 50) and failed/expired imports (latest 20); detailed sanitized errors and retry controls remain in Manage imports and Email delivery status. These bounded counts are not lifetime totals or external alerting. No external error-monitoring account has been configured.

For an incident, pause imports in Manage imports, preserve records, inspect logs, and redeploy a reviewed fix. Rolling back Vercel alone does not roll back Convex: verify schema and API compatibility before choosing a previous frontend deployment. Retain backward-compatible backend fields/functions during rollback. Export a Convex backup before destructive migrations; this stage adds tables/indexes and does not migrate or delete existing cohort data.
