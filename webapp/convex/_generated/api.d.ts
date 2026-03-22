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
import type * as actions__helpers from "../actions/_helpers.js";
import type * as actions_email from "../actions/email.js";
import type * as actions_files from "../actions/files.js";
import type * as actions_payments from "../actions/payments.js";
import type * as auth from "../auth.js";
import type * as externalServicesHttp from "../externalServicesHttp.js";
import type * as functions__audit from "../functions/_audit.js";
import type * as functions__departmentUserGuard from "../functions/_departmentUserGuard.js";
import type * as functions__roleGuard from "../functions/_roleGuard.js";
import type * as functions__tenantGuard from "../functions/_tenantGuard.js";
import type * as functions_auditLogs from "../functions/auditLogs.js";
import type * as functions_auth from "../functions/auth.js";
import type * as functions_departmentUserAuth from "../functions/departmentUserAuth.js";
import type * as functions_departmentUserDashboard from "../functions/departmentUserDashboard.js";
import type * as functions_externalServices from "../functions/externalServices.js";
import type * as functions_platformAdminAuth from "../functions/platformAdminAuth.js";
import type * as functions_platformAdminDashboard from "../functions/platformAdminDashboard.js";
import type * as functions_procurementOfficerDashboard from "../functions/procurementOfficerDashboard.js";
import type * as functions_salesInquiries from "../functions/salesInquiries.js";
import type * as functions_securityAudit from "../functions/securityAudit.js";
import type * as functions_sessions from "../functions/sessions.js";
import type * as functions_tenantAdminDashboard from "../functions/tenantAdminDashboard.js";
import type * as functions_tenantAdminOnboarding from "../functions/tenantAdminOnboarding.js";
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
  "actions/_helpers": typeof actions__helpers;
  "actions/email": typeof actions_email;
  "actions/files": typeof actions_files;
  "actions/payments": typeof actions_payments;
  auth: typeof auth;
  externalServicesHttp: typeof externalServicesHttp;
  "functions/_audit": typeof functions__audit;
  "functions/_departmentUserGuard": typeof functions__departmentUserGuard;
  "functions/_roleGuard": typeof functions__roleGuard;
  "functions/_tenantGuard": typeof functions__tenantGuard;
  "functions/auditLogs": typeof functions_auditLogs;
  "functions/auth": typeof functions_auth;
  "functions/departmentUserAuth": typeof functions_departmentUserAuth;
  "functions/departmentUserDashboard": typeof functions_departmentUserDashboard;
  "functions/externalServices": typeof functions_externalServices;
  "functions/platformAdminAuth": typeof functions_platformAdminAuth;
  "functions/platformAdminDashboard": typeof functions_platformAdminDashboard;
  "functions/procurementOfficerDashboard": typeof functions_procurementOfficerDashboard;
  "functions/salesInquiries": typeof functions_salesInquiries;
  "functions/securityAudit": typeof functions_securityAudit;
  "functions/sessions": typeof functions_sessions;
  "functions/tenantAdminDashboard": typeof functions_tenantAdminDashboard;
  "functions/tenantAdminOnboarding": typeof functions_tenantAdminOnboarding;
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
