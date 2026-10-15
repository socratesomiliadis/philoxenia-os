import { ConvexError, v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import type { TableNames } from "./_generated/dataModel";
import * as cohorts from "./cohorts";
import * as users from "./users";
import * as invitations from "./invitations";
import * as opportunities from "./opportunities";
import * as openDoors from "./openDoors";
import * as sprint from "./sprint";
import * as commandCenter from "./commandCenter";
import { READ_SCOPE, WRITE_SCOPE } from "../lib/mcp-policy";
import { requireOrganizer } from "./access";

type Validator = { type: string; tableName?: string; value?: unknown };
type Field = { fieldType: Validator; optional: boolean };
type Schema = Record<string, unknown>;

// Keep MCP schemas and validation in sync with the existing Convex functions.
// These two Convex adapter APIs are internal; the gateway integration tests cover
// their argument format, including table-specific IDs and nested required fields.
function jsonSchema(validator: Validator): Schema {
  switch (validator.type) {
    case "id": return { type: "string", description: `An existing ${validator.tableName} ID returned by a read tool.` };
    case "string": case "number": case "boolean": case "null": return { type: validator.type };
    case "literal": return { const: validator.value, type: typeof validator.value };
    case "array": return { type: "array", items: jsonSchema(validator.value as Validator) };
    case "union": return { anyOf: (validator.value as Validator[]).map(jsonSchema) };
    case "object": {
      const entries = Object.entries(validator.value as Record<string, Field>);
      return { type: "object", properties: Object.fromEntries(entries.map(([key, field]) => [key, jsonSchema(field.fieldType)])),
        required: entries.filter(([, field]) => !field.optional).map(([key]) => key), additionalProperties: false };
    }
    default: throw new Error(`Unsupported MCP validator: ${validator.type}`);
  }
}

function validate(ctx: MutationCtx, validator: Validator, value: unknown, path = "arguments"): void {
  const fail = () => { throw new ConvexError(`Invalid ${path}. Use the tool's input schema and IDs returned by read tools.`); };
  switch (validator.type) {
    case "id": if (typeof value !== "string" || !ctx.db.normalizeId(validator.tableName as TableNames, value)) fail(); return;
    case "string": case "boolean": if (typeof value !== validator.type) fail(); return;
    case "number": if (typeof value !== "number" || !Number.isFinite(value)) fail(); return;
    case "null": if (value !== null) fail(); return;
    case "literal": if (value !== validator.value) fail(); return;
    case "array": if (!Array.isArray(value)) return fail(); value.forEach((item, i) => validate(ctx, validator.value as Validator, item, `${path}[${i}]`)); return;
    case "union": {
      for (const option of validator.value as Validator[]) {
        try { validate(ctx, option, value, path); return; } catch { /* Try the next allowed variant. */ }
      }
      return fail();
    }
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
      const fields = validator.value as Record<string, Field>, object = value as Record<string, unknown>;
      if (Object.keys(object).some((key) => !Object.hasOwn(fields, key))) fail();
      for (const [key, field] of Object.entries(fields)) {
        if (object[key] === undefined && field.optional) continue;
        validate(ctx, field.fieldType, object[key], `${path}.${key}`);
      }
      return;
    }
    default: return fail();
  }
}

function tool(name: string, description: string, write: boolean,
  registered: { isConvexFunction: true }, preset: Record<string, unknown> = {}, guard?: (ctx: MutationCtx, args: Record<string, unknown>) => Promise<void>) {
  const fn = registered as unknown as { exportArgs(): string; _handler: (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown> };
  const validator = JSON.parse(fn.exportArgs()) as Validator;
  const visible = { ...validator, value: Object.fromEntries(Object.entries(validator.value as Record<string, Field>).filter(([key]) => !Object.hasOwn(preset, key))) };
  return {
    name, description, scope: write ? WRITE_SCOPE : READ_SCOPE,
    inputSchema: jsonSchema(visible) as Schema & { type: "object" },
    annotations: { readOnlyHint: !write, destructiveHint: write, idempotentHint: !write, openWorldHint: name === "invite_user" },
    async run(ctx: MutationCtx, input: unknown): Promise<unknown> {
      validate(ctx, visible, input);
      const args = { ...(input as Record<string, unknown>), ...preset };
      validate(ctx, validator, args);
      if (guard) await guard(ctx, args);
      return (await fn._handler(ctx, args)) ?? null;
    },
  };
}

const listUsers = query({ args: { cursor: v.union(v.string(), v.null()), limit: v.number() }, handler: async (ctx, args) => {
  await requireOrganizer(ctx);
  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100) throw new ConvexError("Choose a limit from 1 to 100.");
  const page = await ctx.db.query("profiles").paginate({ cursor: args.cursor, numItems: args.limit });
  return { ...page, page: page.page.map(({ _id, name, email, image, isAlumni, suspended, community }) => ({ _id, name, email, image, isAlumni, suspended, community })) };
} });

export const mcpTools = [
  tool("list_users", "List all workspace profiles, including suspended users and alumni. Start with cursor null and limit 50; continue with continueCursor until isDone.", false, listUsers),
  tool("list_cohorts", "List all cohorts and their IDs, dates, and status.", false, cohorts.list),
  tool("get_roster", "Read cohort users, memberships, suspensions, and pending/revoked invitations.", false, cohorts.roster),
  tool("get_cohort_summary", "Read participant missions, attention flags, help check-ins, progress, requests, and private organizer notes.", false, commandCenter.cohortSummary),
  tool("get_operations", "Read backend configuration readiness, import status, and email delivery status. Never returns credentials.", false, commandCenter.operations),
  tool("create_cohort", "Create a 14-day cohort. startDate is an ISO date in San Francisco time.", true, cohorts.create),
  tool("update_cohort", "Update a cohort's details, arrival date, and status.", true, cohorts.update),
  tool("invite_user", "Invite an email to an upcoming/active cohort. Queues an invitation email when configured.", true, invitations.invite),
  tool("revoke_invitation", "Revoke a pending invitation. For accepted invitations, update membership instead.", true, invitations.revoke),
  tool("update_membership", "Change cohort access or individual arrival dates. Omit startDateOverride to clear an override; suspension remains separate unless explicitly provided.", true, cohorts.updateMembership),
  tool("set_user_suspended", "Suspend or restore a participant across the workspace. Organizer accounts are protected.", true, users.setSuspended),
  tool("graduate_user", "Graduate an active participant of a completed cohort to alumni.", true, openDoors.graduate),
  tool("list_opportunities", "Read all opportunities, including drafts and archives, with updatedAt for safe edits.", false, opportunities.list, { management: true }),
  tool("save_opportunity", "Create, edit, publish, or archive a listing. Read first and supply expectedUpdatedAt for edits. Published alumni listings require explicit confirmSupport consent.", true, opportunities.save),
  tool("list_offers", "Read published Open Doors offers and their remaining capacity.", false, openDoors.catalog),
  tool("list_requests", "Read all Open Doors requests, current revisions, and private coordination notes. Only the receiving alumnus can approve or decline.", false, openDoors.requests, { organizer: true }),
  tool("coordinate_request", "Claim/update a request's private organizer coordination note. Supply expectedUpdatedAt from the existing coordination to prevent conflicts.", true, openDoors.coordinate),
  tool("complete_request", "Mark agreed support completed as organizer, preserving request revision checks and notifications.", true, openDoors.complete),
  tool("list_activities", "Read shared cohort Sprint activities and revisions.", false, sprint.shared),
  tool("get_participant_sprint", "Read a participant Sprint and outcomes. Provide their profileId and cohortId.", false, sprint.get),
  tool("save_activity", "Create/edit a shared cohort activity. New activities use expectedRevision 0. Times are Unix milliseconds; day is an ISO SF date. Read revisions before editing.", true, sprint.saveActivity, { scope: "cohort", expectedProgressRevision: 0, opportunityId: undefined, goalLink: undefined }),
  tool("cancel_activity", "Cancel a shared cohort activity using its current expectedRevision. Personal participant activities cannot be changed.", true, sprint.removeActivity, {}, async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId as import("./_generated/dataModel").Id<"sprintActivities">);
    if (!activity || activity.scope !== "cohort") throw new ConvexError("Choose a shared cohort activity.");
  }),
  tool("restore_activity", "Restore a cancelled shared activity with its latest expectedRevision.", true, sprint.restoreActivity),
  tool("save_participant_note", "Save a private organizer follow-up note; expectedRevision 0 creates a note, otherwise use the current revision.", true, commandCenter.saveNote),
  tool("resolve_checkin", "Resolve a participant help check-in with its current expectedRevision.", true, commandCenter.resolveCheckin),
];
