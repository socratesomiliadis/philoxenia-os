# Organiser MCP access

Philoxenia exposes a remote Streamable HTTP MCP server at **`https://YOUR_APP/api/mcp`**. Organisers can use OAuth sign-in or a personal bearer token. Permanent user deletion stays in the app. Participants and alumni cannot create organiser connections.

## Enable it

1. Deploy the Convex schema/functions and the Next.js app together using the existing release workflow.
2. Set `SITE_URL` to the app's exact canonical origin in **both Next.js and Convex**. Use HTTPS in production; local development can use `http://localhost:3000`. These values must agree because credentials are bound to `/api/mcp` at that origin. No new signing secret or external OAuth provider is required; browser sign-in uses the existing Better Auth setup.
3. Sign in as a verified, provisioned organiser and open **Command Center → Settings → Connect your agent**. Copy the server URL.
4. Add it in your client and approve access in Philoxenia. Each approval creates a separate revocable connection. An agent may request read access, or read and write access; review the consent screen before allowing it.

## Codex

```shell
codex mcp add philoxenia --url https://YOUR_APP/api/mcp
codex mcp login philoxenia --scopes organizer:read,organizer:write
```

Use `--scopes organizer:read` for read-only access. In the desktop app, you can also add the URL in MCP server settings. See the [Codex MCP documentation](https://developers.openai.com/codex/mcp).

For a personal token, create one in Philoxenia settings and store it in the environment supplied to Codex:

```toml
[mcp_servers.philoxenia]
url = "https://YOUR_APP/api/mcp"
bearer_token_env_var = "PHILOXENIA_MCP_TOKEN"
```

Keep the actual token out of shared configuration and source control. Restart a running client after updating its environment.

## Claude

For Claude Code:

```shell
claude mcp add --transport http philoxenia https://YOUR_APP/api/mcp
```

Open `/mcp` and choose the server to authenticate. Claude's remote connector UI can also accept the server URL and start OAuth, where supported by your plan/workspace. See [Claude Code's MCP guide](https://code.claude.com/docs/en/mcp).

## ChatGPT

In a workspace that allows custom MCP apps, enable developer mode, create a custom app/connector with the HTTPS server URL, and select OAuth. Complete the Philoxenia consent screen, then use its tools in a chat. Available controls depend on your plan and workspace policy; see [ChatGPT developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt). Use OAuth for ChatGPT; the personal token option is intended for clients with configurable bearer headers.

Hosted clients need a publicly reachable HTTPS app. A URL on your computer's localhost is suitable for local clients, but cannot be reached by a hosted connector.

## Available workflows

| Area | Tools |
| --- | --- |
| Users and cohorts | List users/cohorts, read rosters, create/update cohorts, invite users, revoke invitations, update memberships/dates, suspend/restore participants, graduate alumni |
| Opportunities | Read drafts/published/archived listings; create, edit, publish, archive |
| Open Doors | Read offers/requests, claim or update coordination notes, mark agreed support completed |
| Sprint | Read shared activities or participant Sprints, create/edit/cancel/restore shared activities |
| Follow-up | Read cohort summaries and missions, save private participant notes, resolve check-ins, read operational status |

Example requests: “Show participants who need a follow-up in the active cohort”; “Draft an opportunity from this event link”; “Invite these three people to the November cohort”; “Show unanswered Open Doors requests and add my coordination note.”

Ask the agent to read records before editing. Tools expose IDs and current `revision`/`updatedAt` values; edits retain the app's conflict checks. Cohort dates and untimed activity days use San Francisco calendar dates; timed activities use Unix milliseconds. Invitations retain the app's email behaviour. Alumni approval/decline, participant acceptance, personal Sprint changes, permanent account deletion, and changes to the organiser allowlist are not exposed.

## Access and operation

- `organizer:read` includes participant email addresses, missions, and private organiser notes. `organizer:write` additionally permits the listed organiser changes. Both are shown during consent; personal tokens default to read-only.
- Credentials are stored as SHA-256 hashes. Personal tokens are shown once and expire in 1–90 days. OAuth access tokens expire in one hour; refresh tokens rotate on use and stop working after 30 days from initial approval. A refresh can reduce permissions, never expand them.
- Every call checks the current auth user's verified email, organiser allowlist, profile, suspension, token expiry, and revocation. Removing organiser access immediately blocks existing credentials. Normal browser session cookies and Convex JWTs are not accepted as MCP credentials.
- Revoke a connection in settings to disable both access and refresh tokens. The activity list records successful tool names, connection IDs, organiser IDs, and timestamps; it does not record tool arguments, returned data, or plaintext credentials.
- Connections allow up to 60 successful tool calls per minute. Token creation, authorisation, and public dynamic client registration have separate limits. Invalid operations return tool errors and roll back their mutations.
- Transport is stateless JSON over Streamable HTTP, suitable for multiple application instances. There are no long-lived SSE sessions or legacy `/sse` endpoint. Requests with an `Origin` header must match `SITE_URL`; ordinary native clients and hosted backend connectors do not require a browser cross-origin request.
- OAuth discovery is at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/api/mcp` (also available at the root protected-resource path). Public client registration accepts exact HTTPS callback URLs and loopback HTTP URLs. Authorization codes require S256 PKCE and are bound to the registered client, redirect URI, scopes, and exact MCP resource. Codes expire after five minutes and are single-use.
- The tool adapter reuses existing Convex handlers and their exported validators. The adapter is isolated in `convex/mcpTools.ts`; it uses Convex's internal handler/schema accessors, so run `pnpm test -- tests/mcp.test.ts` when upgrading Convex.

The implementation is exercised with an actual MCP SDK client against the route and authenticated Convex tests. Live account connections in Claude, ChatGPT, and Codex still require deploying the app, matching `SITE_URL` configuration, and completing each client's consent flow.
