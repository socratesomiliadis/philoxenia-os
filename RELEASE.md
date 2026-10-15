# Pilot release

Target frontend: **https://philoxenia-os.socrates.fyi**. Both the hosted frontend and localhost intentionally use the existing cloud **development** Convex deployment **fine-starfish-961**. They share users, data, auth credentials, functions, scheduled jobs, and provider usage. Local backend changes immediately affect the hosted app once pushed. No data migration or new production Convex deployment is needed.

## Shared environment

| Setting | Local Next.js (.env.local) | Vercel Production | Convex dev deployment |
| --- | --- | --- | --- |
| CONVEX_DEPLOYMENT | dev:fine-starfish-961 | Not needed | Selected deployment |
| NEXT_PUBLIC_CONVEX_URL | https://fine-starfish-961.convex.cloud | Same | Built in |
| NEXT_PUBLIC_CONVEX_SITE_URL | https://fine-starfish-961.convex.site | Same | Built in |
| SITE_URL | https://philoxenia-os.socrates.fyi | Same | Same |
| AUTH_TRUSTED_ORIGINS | Not needed | Not needed | http://localhost:3000 |
| CONVEX_DEPLOY_KEY | Not needed | Not needed | Not needed |

SITE_URL is the canonical origin for notification/invitation links and MCP. Better Auth resolves its own Google callbacks, verification links, and password reset links per request using SITE_URL plus AUTH_TRUSTED_ORIGINS. The Next.js auth proxy supplies the original host/protocol. Use exact origins with no trailing slash; separate additional origins with commas. Only add localhost ports you actually use. Cookies/sign-in remain separate in each browser origin, while accounts and application data are shared.

Keep BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ORGANIZER_EMAILS, RESEND_API_KEY, EMAIL_FROM, and any AI/import credentials on this existing Convex dev deployment. Preserve their existing values; no secret rotation is needed for a domain change. Check the sender domain in Resend if email delivery is not already working. Changing the frontend domain alone does not require a new email sender domain.

The backend origin settings can be applied with:

~~~powershell
pnpm exec convex env set SITE_URL https://philoxenia-os.socrates.fyi
pnpm exec convex env set AUTH_TRUSTED_ORIGINS http://localhost:3000
~~~

## Google OAuth

In the **existing Google Web application OAuth client** used by the shared backend, retain localhost and add the hosted app:

| Setting | Values |
| --- | --- |
| Authorized JavaScript origins | http://localhost:3000 and https://philoxenia-os.socrates.fyi |
| Authorized redirect URIs | http://localhost:3000/api/auth/callback/google and https://philoxenia-os.socrates.fyi/api/auth/callback/google |

Do not use the Convex .site URL as the Google callback: this app proxies authentication through Next.js. Update the Google consent screen homepage/privacy/terms URLs if they reference the old frontend. If Google asks for an authorized domain, use socrates.fyi and complete its ownership verification if required. If the OAuth app is in Testing, add all intended Google sign-in users as test users or publish the consent configuration when ready. No new Google client or credentials are needed solely for the domain change.

## Vercel and DNS

1. In the existing Vercel project's **Settings → Domains**, add philoxenia-os.socrates.fyi and attach it to Production.
2. At the DNS provider for socrates.fyi, create the record Vercel shows for the philoxenia-os subdomain. Use Vercel's exact suggested target; wait for valid DNS and HTTPS certificate status. When using Cloudflare, begin with DNS-only while validating the Vercel domain.
3. Set the three Vercel Production environment variables in the table above: both NEXT_PUBLIC_CONVEX URLs and SITE_URL. Remove stale Production CONVEX_DEPLOY_KEY and CONVEX_DEPLOYMENT variables. No Convex deployment key is needed because the frontend release no longer deploys the backend.
4. Use the Next.js preset and pnpm install --frozen-lockfile. Set the **Production build command** to pnpm build:release. This validates the shared dev URL and canonical domain, derives the matching auth .site URL, and runs Next.js build. Preview builds should use pnpm build with a deliberately selected backend; do not attach arbitrary preview domains to the shared auth allowlist.
5. Publish backend changes from the reviewed working tree with pnpm exec convex dev --once, then redeploy Vercel. The normal pnpm dev:backend watcher also publishes to this same shared backend. Vercel release builds intentionally publish only the frontend. Neither pnpm build nor pnpm build:release publishes Convex functions.
6. Redirect any old public frontend domain to the new canonical domain in Vercel. If it must continue serving the app independently, explicitly configure it in the auth allowlist and Google OAuth too.

NEXT_PUBLIC variables are embedded at build time, so redeploy after changing them. The release script checks the deployment URL but does not need backend credentials. Keep private keys out of NEXT_PUBLIC variables and source control. The local .env.local remains ignored by git.

MCP clients should connect at https://philoxenia-os.socrates.fyi/api/mcp. Reconnect OAuth clients and issue new personal tokens if the previous canonical SITE_URL differed; credentials are bound to their original resource URL. Keep the canonical SITE_URL identical locally and remotely. Local browser authentication still works at localhost, but MCP advertises the hosted URL.

Development /preview routes return 404 in a production build, including Vercel Preview. The app advertises noindex and disallows search-engine crawling, while allowing social link-preview crawlers to read generic page metadata and the shared image; authorization remains enforced by Convex. A successful build or mocked rehearsal does not establish live Google sign-in, email delivery, or pilot readiness.

Official references: [Convex on Vercel](https://docs.convex.dev/production/hosting/vercel), [Better Auth dynamic base URL](https://better-auth.com/docs/guides/dynamic-base-url), [Convex + Better Auth Next.js proxy](https://labs.convex.dev/better-auth/framework-guides/next), [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## Pilot rehearsal and handover

Complete these on production using controlled invited accounts before inviting the pilot. Record the date, deployment/commit, tester, and result; keep account details and private data out of the repository.

1. Both organizers sign in with verified Google or email/password accounts and independently open Command Center. Check **Pilot operations** for two provisioned organizers, HTTPS origin, OAuth and email configuration. Credential flags alone do not establish readiness.
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
