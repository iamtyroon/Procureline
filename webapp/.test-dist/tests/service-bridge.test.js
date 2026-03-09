"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServiceBridgeTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const procureline_service_auth_1 = require("../lib/services/procureline-service-auth");
const external_service_client_1 = require("../lib/services/external-service-client");
function decodePayload(token) {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8"));
}
async function runServiceBridgeTests() {
    const completed = [];
    const token = await (0, procureline_service_auth_1.createProcurelineServiceToken)({
        issuedAtSeconds: 100,
        jti: "token-123",
        role: "tenant_admin",
        secret: "shared-secret",
        tenantId: "tenant_1",
        userId: "user_1",
    });
    const payload = decodePayload(token);
    strict_1.default.equal(payload.iss, "procureline.webapp");
    strict_1.default.equal(payload.aud, "procureline.nestjs");
    strict_1.default.equal(payload.sub, "user_1");
    strict_1.default.equal(payload.tenantId, "tenant_1");
    strict_1.default.equal(payload.role, "tenant_admin");
    strict_1.default.equal(payload.exp, 400);
    completed.push("service token claims follow the canonical Procureline contract");
    const headers = (0, procureline_service_auth_1.buildProcurelineServiceHeaders)("signed-token");
    strict_1.default.equal(headers.Authorization, "Bearer signed-token");
    strict_1.default.equal(headers["Content-Type"], "application/json");
    completed.push("service request headers include bearer auth and json content type");
    process.env.NESTJS_URL = "http://localhost:4001/";
    const request = (0, external_service_client_1.createNestServiceRequest)({
        body: { hello: "world" },
        path: "/api/services/payments/subscriptions",
        token: "signed-token",
    });
    strict_1.default.equal(request.url, "http://localhost:4001/api/services/payments/subscriptions");
    strict_1.default.equal(request.init.method, "POST");
    strict_1.default.equal(request.init.body, JSON.stringify({ hello: "world" }));
    completed.push("service request builder normalizes the NestJS base url");
    const developmentSecret = (0, procureline_service_auth_1.resolveProcurelineConvexSyncSecret)({
        nodeEnv: "development",
        secret: undefined,
    });
    strict_1.default.equal(developmentSecret, procureline_service_auth_1.DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET);
    completed.push("development sync secret falls back to the documented local default");
    return completed;
}
exports.runServiceBridgeTests = runServiceBridgeTests;
