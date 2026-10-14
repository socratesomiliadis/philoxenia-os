import type { Page } from "@playwright/test";

// Browser-only transport fixtures: no session or authentication bypass is added
// to the application, and none of these requests reach the real backend.
export async function mockSession(page: Page, options: {
  user: { id: string; name: string; email: string };
  query: (path: string, args: Record<string, unknown>) => unknown;
  mutate: (path: string, args: Record<string, unknown>) => unknown;
  action?: (path: string, args: Record<string, unknown>) => unknown | Promise<unknown>;
}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "RS256" })}.${encode({ sub: options.user.id, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
  await page.route("**/api/auth/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/get-session")) return route.fulfill({ json: { user: { ...options.user, emailVerified: true }, session: { id: "test-session", userId: options.user.id, expiresAt: new Date(Date.now() + 3_600_000).toISOString() } } });
    if (url.pathname.endsWith("/convex/token")) return route.fulfill({ json: { token } });
    return route.fulfill({ json: {} });
  });
  await page.routeWebSocket(/\/api\/.*\/sync/, (socket) => {
    let version = { querySet: 0, identity: 0, ts: "AAAAAAAAAAA=" };
    let time = BigInt(0);
    const queries = new Map<number, { path: string; args: Record<string, unknown> }>();
    function transition(querySet = version.querySet, identity = version.identity) {
      const timestamp = Buffer.alloc(8);
      timestamp.writeBigUInt64LE(++time);
      const next = { querySet, identity, ts: timestamp.toString("base64") };
      socket.send(JSON.stringify({ type: "Transition", startVersion: version, endVersion: next, modifications: [...queries].map(([queryId, query]) => ({ type: "QueryUpdated", queryId, value: options.query(query.path, query.args), logLines: [], journal: null })) }));
      version = next;
    }
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.type === "Authenticate") transition(undefined, message.baseVersion + 1);
      if (message.type === "ModifyQuerySet") {
        for (const modification of message.modifications) {
          if (modification.type === "Add") queries.set(modification.queryId, { path: modification.udfPath, args: modification.args[0] ?? {} });
          else queries.delete(modification.queryId);
        }
        transition(message.newVersion);
      }
      if (message.type === "Mutation") {
        try {
          const result = options.mutate(message.udfPath, message.args[0] ?? {});
          socket.send(JSON.stringify({ type: "MutationResponse", requestId: message.requestId, success: true, result, ts: version.ts, logLines: [] }));
          transition();
        } catch (failure) {
          const error = failure instanceof Error ? failure.message : "Mutation failed";
          socket.send(JSON.stringify({ type: "MutationResponse", requestId: message.requestId, success: false, result: error, errorData: error, logLines: [] }));
        }
      }
      if (message.type === "Action") {
        Promise.resolve().then(async () => {
          if (!options.action) throw new Error(`Unexpected action: ${message.udfPath}`);
          const result = await options.action(message.udfPath, message.args[0] ?? {});
          socket.send(JSON.stringify({ type: "ActionResponse", requestId: message.requestId, success: true, result, logLines: [] }));
          transition();
        }).catch((failure) => {
          const error = failure instanceof Error ? failure.message : "Action failed";
          socket.send(JSON.stringify({ type: "ActionResponse", requestId: message.requestId, success: false, result: error, errorData: error, logLines: [] }));
        });
      }
    });
  });
}
