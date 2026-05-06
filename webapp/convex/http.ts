import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { handleDevEmailCapture } from "./devEmailHttp";
import {
  handleExternalServiceSync,
  handleReminderDispatchClaim,
} from "./externalServicesHttp";

const http = httpRouter();

// Story 1.9 scope note: the current password-based auth setup only exposes
// Convex's well-known metadata routes here. Shared origin policy logic lives in
// `lib/backend/security/origins.ts` for app-owned HTTP surfaces that require it.
auth.addHttpRoutes(http);
http.route({
  path: "/api/services/sync",
  method: "POST",
  handler: handleExternalServiceSync,
});
http.route({
  path: "/api/services/deadlines/reminder-dispatch",
  method: "POST",
  handler: handleReminderDispatchClaim,
});
http.route({
  path: "/api/dev-email/capture",
  method: "POST",
  handler: handleDevEmailCapture,
});

export default http;
