import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// Server-only context identity. No request argument can set this WeakMap.
// The MCP gateway verifies the credential and current organizer before attaching it.
const identities = new WeakMap<object, Doc<"profiles">>();
export function mcpIdentity(ctx: QueryCtx | MutationCtx) { return identities.get(ctx); }
export async function withMcpIdentity<T>(ctx: MutationCtx, profile: Doc<"profiles">, run: () => Promise<T>) {
  identities.set(ctx, profile);
  try { return await run(); } finally { identities.delete(ctx); }
}
