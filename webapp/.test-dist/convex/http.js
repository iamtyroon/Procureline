"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("convex/server");
const auth_1 = require("./auth");
const devEmailHttp_1 = require("./devEmailHttp");
const externalServicesHttp_1 = require("./externalServicesHttp");
const http = (0, server_1.httpRouter)();
// Story 1.9 scope note: the current password-based auth setup only exposes
// Convex's well-known metadata routes here. Shared origin policy logic lives in
// `lib/security/origins.ts` for app-owned HTTP surfaces that require it.
auth_1.auth.addHttpRoutes(http);
http.route({
    path: "/api/services/sync",
    method: "POST",
    handler: externalServicesHttp_1.handleExternalServiceSync,
});
http.route({
    path: "/api/services/deadlines/reminder-dispatch",
    method: "POST",
    handler: externalServicesHttp_1.handleReminderDispatchClaim,
});
http.route({
    path: "/api/dev-email/capture",
    method: "POST",
    handler: devEmailHttp_1.handleDevEmailCapture,
});
exports.default = http;
