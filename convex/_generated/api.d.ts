/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as auth from "../auth.js";
import type * as cohorts from "../cohorts.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as ingestion from "../ingestion.js";
import type * as ingestionActions from "../ingestionActions.js";
import type * as ingestionValidators from "../ingestionValidators.js";
import type * as invitations from "../invitations.js";
import type * as missionValidators from "../missionValidators.js";
import type * as missions from "../missions.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as openDoors from "../openDoors.js";
import type * as openDoorsValidators from "../openDoorsValidators.js";
import type * as opportunities from "../opportunities.js";
import type * as opportunityValidators from "../opportunityValidators.js";
import type * as sprint from "../sprint.js";
import type * as sprintValidators from "../sprintValidators.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  auth: typeof auth;
  cohorts: typeof cohorts;
  crons: typeof crons;
  http: typeof http;
  ingestion: typeof ingestion;
  ingestionActions: typeof ingestionActions;
  ingestionValidators: typeof ingestionValidators;
  invitations: typeof invitations;
  missionValidators: typeof missionValidators;
  missions: typeof missions;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  openDoors: typeof openDoors;
  openDoorsValidators: typeof openDoorsValidators;
  opportunities: typeof opportunities;
  opportunityValidators: typeof opportunityValidators;
  sprint: typeof sprint;
  sprintValidators: typeof sprintValidators;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
