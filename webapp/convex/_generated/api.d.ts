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
import type * as crons from "../crons.js";
import type * as devEmailHttp from "../devEmailHttp.js";
import type * as emailTransport from "../emailTransport.js";
import type * as externalServicesHttp from "../externalServicesHttp.js";
import type * as functions__audit from "../functions/_audit.js";
import type * as functions__departmentUserGuard from "../functions/_departmentUserGuard.js";
import type * as functions__roleGuard from "../functions/_roleGuard.js";
import type * as functions__tenantGuard from "../functions/_tenantGuard.js";
import type * as functions_accessCodes from "../functions/accessCodes.js";
import type * as functions_auditLogs from "../functions/auditLogs.js";
import type * as functions_auth from "../functions/auth.js";
import type * as functions_catalogRequests from "../functions/catalogRequests.js";
import type * as functions_categories from "../functions/categories.js";
import type * as functions_consolidationExports from "../functions/consolidationExports.js";
import type * as functions_consolidations from "../functions/consolidations.js";
import type * as functions_deadlines from "../functions/deadlines.js";
import type * as functions_departmentUserAuth from "../functions/departmentUserAuth.js";
import type * as functions_departmentUserDashboard from "../functions/departmentUserDashboard.js";
import type * as functions_departments from "../functions/departments.js";
import type * as functions_devEmail from "../functions/devEmail.js";
import type * as functions_externalServices from "../functions/externalServices.js";
import type * as functions_items from "../functions/items.js";
import type * as functions_planRedrafts from "../functions/planRedrafts.js";
import type * as functions_plans from "../functions/plans.js";
import type * as functions_platformAdminAuth from "../functions/platformAdminAuth.js";
import type * as functions_platformAdminDashboard from "../functions/platformAdminDashboard.js";
import type * as functions_procurementOfficerDashboard from "../functions/procurementOfficerDashboard.js";
import type * as functions_procurementOfficerOnboarding from "../functions/procurementOfficerOnboarding.js";
import type * as functions_procurementOfficerPlanReview from "../functions/procurementOfficerPlanReview.js";
import type * as functions_procurementOfficerSubmissions from "../functions/procurementOfficerSubmissions.js";
import type * as functions_requests from "../functions/requests.js";
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
  crons: typeof crons;
  devEmailHttp: typeof devEmailHttp;
  emailTransport: typeof emailTransport;
  externalServicesHttp: typeof externalServicesHttp;
  "functions/_audit": typeof functions__audit;
  "functions/_departmentUserGuard": typeof functions__departmentUserGuard;
  "functions/_roleGuard": typeof functions__roleGuard;
  "functions/_tenantGuard": typeof functions__tenantGuard;
  "functions/accessCodes": typeof functions_accessCodes;
  "functions/auditLogs": typeof functions_auditLogs;
  "functions/auth": typeof functions_auth;
  "functions/catalogRequests": typeof functions_catalogRequests;
  "functions/categories": typeof functions_categories;
  "functions/consolidationExports": typeof functions_consolidationExports;
  "functions/consolidations": typeof functions_consolidations;
  "functions/deadlines": typeof functions_deadlines;
  "functions/departmentUserAuth": typeof functions_departmentUserAuth;
  "functions/departmentUserDashboard": typeof functions_departmentUserDashboard;
  "functions/departments": typeof functions_departments;
  "functions/devEmail": typeof functions_devEmail;
  "functions/externalServices": typeof functions_externalServices;
  "functions/items": typeof functions_items;
  "functions/planRedrafts": typeof functions_planRedrafts;
  "functions/plans": typeof functions_plans;
  "functions/platformAdminAuth": typeof functions_platformAdminAuth;
  "functions/platformAdminDashboard": typeof functions_platformAdminDashboard;
  "functions/procurementOfficerDashboard": typeof functions_procurementOfficerDashboard;
  "functions/procurementOfficerOnboarding": typeof functions_procurementOfficerOnboarding;
  "functions/procurementOfficerPlanReview": typeof functions_procurementOfficerPlanReview;
  "functions/procurementOfficerSubmissions": typeof functions_procurementOfficerSubmissions;
  "functions/requests": typeof functions_requests;
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
