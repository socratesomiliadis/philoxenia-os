# Philoxenia OS

The workspace for Philoxenia by Hustle Hours: two weeks of building, connecting, and opening doors in San Francisco.

## Stages 1–7

Implemented: responsive participant/organizer navigation, Google and verified email/password authentication through Better Auth + Convex, organizer bootstrap, cohort management, approved-email invitations, cohort access controls, participant date overrides, account suspension, and a private community directory. Stage 2 adds resumable onboarding and three editable, measurable mission goals per Hustler and cohort. Stage 3 adds curated opportunity discovery, explained recommendations, private bookmarks, and organizer publishing. Stage 4 adds the 14-day Sprint, shared cohort activities, attendance/completion, mission progress, self-reported outcomes, and calendar exports. Stage 5 adds alumni graduation, shared community profiles, alumni-owned support offers, private requests and alternatives, Sprint meeting links, organizer coordination, in-app notifications, and optional transactional email. Stage 6 adds bounded scheduled event imports, YC CSV imports, separate source snapshots and organizer edits, source-change warnings, and organizer import monitoring.

Stack: Next.js 16.4, React 19, shadcn/ui (Base UI), Sonner, Tailwind v4, Convex, Better Auth, and pnpm. Better Auth is pinned to the version supported by the Convex integration.

Stage 7 adds participant help check-ins (including during onboarding), explained organizer attention flags, private participant follow-up notes, cohort summaries, four CSV exports, visible Open Doors coordinator names, and backend configuration/delivery/import status. Production launch at **https://philoxenia-os.vercel.app** remains pending the production Convex deployment, OAuth/email setup, second organizer, and live pilot rehearsal. Follow [the release runbook](RELEASE.md) for environment separation, `pnpm build:release`, acceptance checks, and operations.

## Run locally

Organisers can also manage the workspace through agents using OAuth or personal access tokens. See [MCP setup and client instructions](MCP.md) for Claude, ChatGPT, and Codex. Connection management is in **Command Center → Settings → Connect your agent**.

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

Until a sign-in method is configured, development routes show a clearly marked sample workspace. Onboarding and opportunity previews allow local-only interactions; organizer writes are disabled. `/preview` is also available in development; it returns 404 in production. Preview never creates a session or authorizes backend access. Production shows the sign-in screen when configuration is incomplete.

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
6. Open **Command Center → New cohort**, set its name and arrival date, then use **Invite Hustler** with the participant's email address. Copy and share the sign-in link. The verified account joins the assigned cohort on first sign-in.

Add a second organizer later by changing `ORGANIZER_EMAILS` to a comma-separated list on the backend. Organizer privileges are never chosen in the browser. An organizer must have a verified email address and a provisioned profile.

Invitations now queue transactional email when the Stage 5 email provider is configured. The shareable sign-in link remains available. Email failures never undo an invitation; check **Command Center → Coordinate Open Doors → Email delivery status**.

### Email and password

Email sign-in works independently of Google OAuth. Set `SITE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM` on the **Convex backend**. Use a Resend-verified sending domain for `EMAIL_FROM`; these are the same mail settings used for invitations. Without mail configuration, email sign-in controls stay disabled.

At `/sign-in`, choose **Create an account**, use your invited email address, and choose an 8–128 character password. Follow the verification email to sign in and accept your invitation. Unverified accounts cannot enter the workspace or claim organizer access. Verification links can be resent, and signing in before verification sends a fresh link.

**Forgot password?** sends a link that expires after one hour. It also lets an existing Google user set a password on the same account, preserving their profile and cohorts. Resetting a password revokes existing sessions. Creating an account never grants access without an invitation or an organizer email configured on the backend.

## Access and dates

- Every protected Convex query and mutation checks authentication and active membership or organizer privileges. An account alone does not grant application access.
- Organizers can see cohorts, rosters, and invitation emails. Hustlers can see only their own cohorts and the community's public profile fields. The community query excludes email addresses.
- Revoking an invitation blocks joining through it. Revoking a membership removes that cohort's access. Suspending a participant blocks all workspace access until restored. Restoring an invitation/membership does not silently remove a suspension.
- Cohort dates are ISO calendar dates in `America/Los_Angeles`. The end date is arrival plus 13 calendar days (14 days inclusive), including across daylight-saving transitions. Optional participant arrival overrides use the same rule.
- A completed cohort remains visible to its members. Organizers can use the participant’s Manage menu to **Graduate to alumni**; cohort membership and past work remain intact. Alumni retain community access independently of cohort membership; suspension still blocks all access.
- To reset a test account, open **Command Center → participant’s Manage button → Delete user**. Type the displayed email and choose **Delete user permanently**. This deletes the Philoxenia profile, all cohort memberships and invitations, onboarding/mission data, generation limits, Better Auth user, linked sign-in records, and sessions. Cohorts and other users remain intact. Organizer accounts cannot be deleted. Use **Invite Hustler** with the same email afterward; the next sign-in creates a fresh profile and starts onboarding. This removes the app’s sign-in record, not the external Google account.

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

Founder and startup listings are public directory entries and do not imply an introduction, meeting, or visit. Alumni offers require a named provider, a specific support/request path, availability or capacity, and a request URL. Publishing requires the organizer to explicitly confirm the alumnus agreed to those details. These curated listings retain their external request paths. Alumni-owned Open Doors offers use the in-app request workflow described below.

**Add curated starters** adds four real directory drafts without overwriting existing curation: [LangChain and Harrison Chase](https://www.langchain.com/about), [Supabase](https://www.ycombinator.com/companies/supabase/jobs), and [Replit](https://replit.com/careers). Primary sources were reviewed October 14, 2026; organizers should review current details before publishing. No live events or alumni availability are invented. The pilot catalog starts empty until an organizer publishes real entries or enables Stage 6 automatic publication.

For development, `/preview/opportunities` contains labeled illustrative events, companies, founders, and offers. Search, filtering, details, and temporary bookmarks work without an account; preview changes reset on leaving the page and never reach Convex. Organizer writes remain disabled in preview, and all preview routes return 404 in production. No production sample seed is run automatically. The catalog query uses indexed publication and bookmark reads and returns the small curated pilot catalog in one subscription; paginate/search server-side before expanding to automated feeds.

Stage 3 backend checks cover publication visibility, organizer authorization, revoked/unverified/suspended members, bookmark isolation and deletion, cohort-specific recommendations, confirmed support paths, source deduplication, concurrent edits, idempotent curation, and SF date boundaries. Browser checks cover discovery on desktop/mobile, keyboard dismissal and focus restoration, authenticated bookmark retry/persistence, and organizer draft-to-publish-to-archive flows. Authenticated browser transport is isolated and mocked; backend authorization is exercised by Convex tests.

## The 14-day Sprint

Open **14-day Sprint** for a day view or full agenda using your selected cohort’s individual stay dates. Add tasks, events, meetings, or challenges; assign an untimed day or leave tasks in **Unscheduled**. Events and meetings require a start and end time. Edit an activity to reschedule it, or remove it after confirming. Tasks without a time remain to-dos until scheduled. Overnight activities appear on each day they occupy.

Use **Add to Sprint** in an opportunity’s details to prefill a personal activity. Events retain the source link and their published times; when no end time is provided, the editor explicitly prefills an adjustable one-hour duration. Directory entries and support offers start as research/request tasks, not confirmed meetings. Adding an opportunity never registers attendance or arranges a meeting. Repeated additions of the same opportunity to the same member/cohort are blocked transactionally. Changes or withdrawal of the original opportunity are flagged while preserving the saved schedule.

All date/time entry and display use `America/Los_Angeles`; timestamps are stored as UTC instants. Nonexistent spring-forward times are rejected. For the repeated fall-back hour, the Sprint editor asks you to select the first (PDT) or second (PST) occurrence and preserves that choice when editing. Activities must fit inside the current stay, including an end exactly at midnight after the last day. The server rechecks overlaps against personal and shared activities; explicitly choose **Keep overlapping time** to save a conflict. Skipped and cancelled activities do not block time. New shared activities or date changes can create conflicts afterward, which remain visible in the planner.

Activity details include **Update progress** for attendance, completion, or skipping. Link an activity to a current mission goal and enter an explicit contribution when marking it complete. The mission panel sums those reported units, with progress bars capped at the target while displaying the actual total. Planning an event, recording an outcome, or marking a task complete without a contribution does not invent progress. Reopening completed progress preserves the saved contribution, including zero. Goal links include the mission’s confirmation version: replacement missions do not inherit earlier contributions; choose a new goal and report the appropriate units. Relinking through the activity editor resets its contribution to zero; changing the goal in **Update progress** also clears the count so you can report units for the new goal. Conflicting activity, progress, and outcome edits are rejected until reopened.

**Record outcome** captures dated, self-reported meetings, feedback, projects, internships, funding conversations, or other results, with a count and optional activity link. Outcomes can be edited or removed and can describe results after the stay. They remain separate from plans and attendance. Removing a personal activity clears its contribution and detaches its outcomes; the reported results are retained. Deleting a participant removes their personal activities, progress, outcomes, and bookmarks while preserving cohort activities and other members’ records.

Organizers use **Command Center → Cohort Sprint → Manage cohort Sprint** to create/edit shared activities and challenges. Hustlers can see these in their own Sprint and record individual attendance and goal contributions; they cannot edit the shared plan. Cancelling keeps a visible cancellation record and excludes the activity from current progress and exports. Organizers can restore it later. A changed shared schedule is flagged for participants who previously updated progress. Participant date overrides are honored; shared or previously saved activities outside the revised stay remain in **Outside your current stay** for review. From a participant’s roster row, **View Sprint** opens a read-only organizer view of their plan, mission progress, and outcomes.

**Export activity** and **Export Sprint** download `.ics` files. Timed activities use UTC `VEVENT` entries; untimed work uses `VTODO` entries with an optional date. IDs remain stable across exports, revisions advance with edits, and text is escaped/folded according to [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545). Skipped and cancelled activities are omitted. To-do support varies by calendar app. These files are snapshots: exporting again does not synchronize changes or remove previously imported calendar entries, and no calendar account is connected automatically.

`/preview/sprint` provides an interactive, labeled sample. Sample changes persist in the current tab’s session storage across navigation and refresh; **Reset sample Sprint** restores the initial sample. Sample opportunities can be added from `/preview/opportunities`. These writes never reach Convex or create an auth session, and preview routes remain unavailable in production. Shared organizer writes are disabled in the organizer preview.

Stage 4 tests cover member/organizer authorization, private schedule/outcome isolation, date overrides, overlap and duplicate races, stale edits, shared completion isolation, cancellation/restoration, mission replacement, account deletion, SF daylight saving transitions, overnight boundaries, and calendar escaping/folding. Browser tests cover planning and rescheduling, conflict acknowledgement, goal contributions, outcomes, refresh, removal, downloads, authenticated opportunity additions with retry, shared organizer challenges, and read-only participant inspection at desktop and mobile widths. Authenticated browser transport is mocked; backend ownership and persistence run through Convex tests.

## Open Doors and the alumni network

In a **completed** cohort’s roster, open the participant’s Manage menu and choose **Graduate to alumni**. Graduation requires an active, unsuspended membership and leaves all memberships, onboarding, missions, schedules, and outcomes intact. Organizer privileges remain separate. Alumni can support later cohorts and participate in another cohort with a new membership.

**Community → Edit your profile** shares only the fields you explicitly enter with approved members: a short bio, headline, location, what you’re building, interests, and what you can offer. Add optional website, LinkedIn, GitHub, X, and Instagram links using full HTTP(S) URLs. Links are validated on the server and open in a new tab. Clear any field to remove it. Existing profiles work without the new optional fields.

Search people by name, bio, headline, interests, skills, or location, and filter by role or cohort, including completed cohort history. **View profile** shows the full bio, shared details, and social links. Private onboarding answers are not copied into community profiles. Email addresses and private goals are excluded; suspended members disappear from the directory.

Alumni use **Open Doors → Offer your support** for mentorship, portfolio reviews, introductions, or other support. Enter concrete support, availability and how to agree a time, and 1–50 concurrent places. Introduction offers require an actual connection and facilitation path. Publish directly as the provider or save a private draft. **Your offers → Edit offer** can change or unpublish a listing; existing requests preserve the offer as it was when requested. Organizer-curated external alumni listings in Opportunities retain their external request paths; Open Doors offers belong to the signed-in alumnus and use this in-app workflow.

A participant chooses a cohort they belong to and explains their goal and fit. Requests are visible only to the requester, receiving alumnus, and organizers. The alumnus approves, declines with an explanation, or describes alternative support. The participant must explicitly **Accept alternative** before it becomes agreed support. One open request per person/offer is allowed across cohorts. Alternatives and agreements reserve places transactionally; pending requests do not. Completion or withdrawal releases a place. Capacity cannot be reduced below reservations. Unpublished offers or suspended/revoked access block new agreements; saved requests are retained. Stale decisions and conflicting edits require reopening the editor.

Approval never creates a calendar entry or invents a meeting time. After agreeing a time and place, the requester uses **Schedule in Sprint** to create one linked, timed personal meeting. The existing SF time editor handles stay limits, daylight saving ambiguity, and overlap acknowledgement; the server checks dates and conflicts again. Edit the meeting in the Sprint. Removing it clears the request’s link and allows another agreed time to be scheduled. Remove the meeting before withdrawing support. Attendance, explicit mission contributions, and linked self-reported outcomes use the existing Sprint tools. **Report support completed** records who reported it and releases capacity, while preserving the offer/request provenance for later relationship features; it does not mark attendance, create an outcome, or assert a verified introduction.

Organizers use **Command Center → Coordinate Open Doors** to search requests across cohorts, filter statuses, inspect scheduled meeting times and linked outcome counts, and save a private coordination note. Saving a note assigns that organizer as coordinator. Participants and alumni cannot read those notes; organizer coordination does not approve support on the alumnus’s behalf.

The header bell opens an in-app inbox for invitation acceptance, graduation, support requests, alternatives, decisions, scheduling, withdrawal, and completion. Notifications belong to the authenticated recipient, with explicit read status. Transactional email is queued separately in a durable delivery record and scheduled after the mutation commits. Emails contain a generic update and app link; private goals, request text, and organizer notes are excluded. No provider failure rolls back the invitation or support action.

To enable email, verify your sending domain in Resend and configure these on the **Convex backend**, alongside the existing `SITE_URL`:

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Server-only Resend sending key |
| `EMAIL_FROM` | Sender on your verified domain, for example `Philoxenia <notifications@your-domain.example>` |
| `SITE_URL` | App origin recipients should open |

Without these values, deliveries are labeled **disabled** and in-app notifications remain available. **Email delivery status** shows the latest 50 records and lets organizers retry failed/disabled deliveries up to five attempts within 23 hours of creation. Requests use a stable delivery idempotency key and a 10-second timeout, with no automatic retry. The bounded retry window stays within [Resend’s documented 24-hour idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys). Older deliveries require sharing the app link directly. Sending follows the [Resend email API](https://resend.com/docs/api-reference/emails/send-email). No real email is sent by tests; provider responses are mocked.

Deleting a user now also removes their offers, requests, private coordination, notifications, and related email records. When deleting an alumnus, other participants’ saved meetings and outcomes remain; their support-request link is detached. The pilot catalog and organizer request list use indexed reads and a small complete subscription; add pagination before expanding the network beyond the pilot.

`/preview/open-doors` provides labeled sample people/offers and a **Sample role** selector for Hustler, alumnus, and organizer. Try a request, alternative, acceptance, meeting, completion, and private sample coordination. Changes stay in the current tab’s session storage across refresh/navigation; meetings appear in `/preview/sprint`. **Reset sample Open Doors** resets offers/requests; use the separate Sprint reset for its activities. Preview never calls Convex or sends email and remains unavailable in production.

Stage 5 backend tests cover graduation/history, explicit public profile privacy, offer ownership/publication, introduction paths, private requests, organizer coordination, duplicate/capacity races, alternative acceptance, declined/withdrawn requests, stale decisions, revoked/unverified/suspended access, meeting/outcome provenance, overlap/stay checks, deletion, notification ownership, failed emails, and bounded delivery retry. Browser tests exercise mobile alternatives and Sprint integration, authenticated request retries and alumnus decisions, attendance/outcomes, organizer graduation/coordination, alumni publishing, keyboard dismissal/focus restoration, and 320px layouts. Authenticated browser transport is mocked; backend tests exercise ownership and persistence with Convex.

## Automated opportunity imports

Open **Command Center → Manage imports**. Imports fetch shared records into Convex; browsing Opportunities never searches external providers. Sources start paused and new records default to **drafts**. Automatic publication applies only to new non-cancelled listings and never republishes archived entries.

| Source | Setup |
| --- | --- |
| Luma iCal | No API key. Choose the SF city feed or paste a public Luma calendar subscription URL. |
| SerpApi Google Events | Set `SERPAPI_API_KEY` in the **Convex backend environment**. Two fixed SF/Bay Area startup-event searches per run, without pagination. |

For Luma, choose **Configure source → Use San Francisco city feed → Enabled → Save source settings**, then **Refresh source**. The default URL was obtained from SF's supported **Add iCal Subscription** control:

```text
https://api.luma.com/ics/get?entity=discover&id=discplace-BDj7GNbGlsF7Cka
```

For another SF/Bay Area community calendar, choose **Add iCal Subscription → Copy URL to Clipboard** on its Luma page and paste that subscription URL. Both `webcal://` and HTTPS links are accepted and normalized to HTTPS. Only public Luma `/ics/get` feeds with `entity=discover` or `entity=calendar` are accepted; personal feeds, other hosts, extra query parameters, credentials, and redirects are rejected. The feed URL is captured when the import is queued, so a settings change cannot redirect in-flight work. See [Luma's subscription guide](https://help.luma.com/p/ical-syncing).

**Refresh source** queues a bounded run, with results appearing live in **Recent import runs**. Manual refreshes require an enabled source and are limited to once per hour. A Convex cron checks at **14:00 UTC daily**, importing once per day when any cohort is upcoming/active and once per seven days otherwise. Both paths share the last-attempt clock and per-source lock. Disabling a source prevents new work; an already started request can finish. Queued jobs recheck configuration and organizer access. Jobs expire after 20 minutes so lost work cannot permanently lock a source. Requests have a 20-second timeout and 2 MB response limit, with no automatic retries.

Both sources use a **30-day discovery window**. Luma accepts at most **50 events per refresh**, inspecting at most 1,000 calendar entries. City feeds include multiple categories; organizers should review the drafts. Coverage is controlled by Luma: its SF feed returned 50 entries when inspected on October 15, 2026, which does not guarantee every upcoming event is included. Standard `ical.js` parsing handles folded lines, escaped text, durations and embedded timezone definitions. UTC timestamps and unambiguous SF timestamps preserve their exact instants; floating, unsupported-zone and DST-ambiguous times are skipped. Recurrence rules/exceptions are skipped rather than expanded. Repeated UIDs use the highest `SEQUENCE`, with modification timestamps as a tie-breaker. Registration links come from `URL` or a Luma link in `DESCRIPTION`. Missing venues remain labeled unannounced. Luma pricing stays **Price not confirmed**, and `TENTATIVE` status does not imply a host approval requirement.

All-day and multi-day entries retain `eventDate` and exclusive `eventEndDate` dates, without inventing midnight meetings. Opportunities shows an inclusive date range and **All day**. Adding one to the Sprint starts an untimed task on its first day; confirm actual times before scheduling. Organizers can edit dates or switch to specific times. Timing fields are protected together when curated, preventing later imports from mixing all-day dates with edited times. Luma documents its multi-day feed behavior in the subscription guide.

SerpApi's human-readable dates are interpreted in `America/Los_Angeles`, including year rollover; missing, unsupported, and DST-ambiguous times and unrelated locations are skipped. SerpApi free/paid pricing is recorded only when explicitly provided. Review the added, updated, and skipped counts in run history.

Luma uses its public subscription feed and consumes ordinary Convex resources, with no external scraping service or provider credit allowance. **Refreshes this month** counts attempts. Each SerpApi run reserves two searches transactionally; the maximum configurable allowance is **200 searches per UTC calendar month**. Manual and scheduled runs share that counter. Failed, expired, and uncertain requests retain their reservation because a provider may already have charged. Reservations are upper bounds for this app, separate from provider billing periods and other applications' usage. Verify your current [SerpApi plan](https://serpapi.com/pricing) and account limits before enabling it. No automatic paid upgrades are configured.

Provider source IDs and canonical registration URLs deduplicate repeated imports and shared Luma links across providers, including `lu.ma`/`luma.com` aliases and tracking parameters. Separate `opportunitySources` records retain provider IDs, normalized snapshots, canonical URLs, last-import times, and run provenance. The first source remains authoritative; additional providers attach provenance without overwriting it. Existing curated listings retain all their fields when first attached to a source. Subsequent organizer edits protect only the changed fields. Publication status and organizer picks are always organizer-controlled. **Manage opportunities → Source details** shows the latest source snapshots and protected fields; **Restore imported fields** explicitly restores the primary source's values while preserving publication and organizer pick. Listing edits and restores reject stale revisions.

Unchanged imports update freshness without generating Sprint change warnings. Changed source snapshots warn people with linked Sprint activities; saved times, attendance and outcomes remain intact. Explicit iCal `STATUS:CANCELLED` or `METHOD:CANCEL` reports flag listings and block new Sprint additions, including UID-only notices for existing sources. Missing status fields cannot retract an earlier cancellation. Absence from a bounded feed never deletes or cancels a listing. Empty valid calendars succeed without removing records; malformed calendars and provider failures preserve the catalog. The imports view flags sources stale after their cadence plus one day; listing details flag imports older than eight days. Errors use sanitized messages and never include raw provider payloads or keys.

**Import YC CSV** supports up to **50 entries / 200 KB**, with atomic row validation, escaped quotes, embedded newlines, and row-specific errors. Download `/templates/yc-opportunities.csv` from the import dialog. Required headers are `title,summary,description,sourceUrl,interests,area,location`. Use `|` between interests, `sf`, `bay-area`, or `online` for area, and original `https://www.ycombinator.com/companies/<slug>` directory links. Imports create startup drafts, and repeats preserve organizer edits. YC records can also be curated manually. Product Hunt API ingestion remains deferred; add curated product links through **Add opportunity**.

`/preview/organizer → Manage imports` shows setup controls with writes disabled. Automated tests use fixture calendars and mocked provider responses. A separate read-only check fetched the live SF feed without creating listings. Tests cover folded lines, all-day ranges, timezone handling, UID revisions, cancellations, feed URL validation, response limits, deduplication, curation, search reservations, authorization, failure preservation, and mobile/keyboard flows.

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
