/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendPasswordReset from "../ResendPasswordReset.js";
import type * as auth from "../auth.js";
import type * as functions_auth from "../functions/auth.js";
import type * as functions_sessions from "../functions/sessions.js";
import type * as functions_tenants from "../functions/tenants.js";
import type * as functions_users from "../functions/users.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as seedData from "../seedData.js";
import type * as subscriptionTiers from "../subscriptionTiers.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  ResendPasswordReset: typeof ResendPasswordReset;
  auth: typeof auth;
  "functions/auth": typeof functions_auth;
  "functions/sessions": typeof functions_sessions;
  "functions/tenants": typeof functions_tenants;
  "functions/users": typeof functions_users;
  http: typeof http;
  migrations: typeof migrations;
  seedData: typeof seedData;
  subscriptionTiers: typeof subscriptionTiers;
  utils: typeof utils;
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

export declare const components: {};
