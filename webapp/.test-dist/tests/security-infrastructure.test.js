"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSecurityInfrastructureTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const audit_1 = require("../lib/security/audit");
const bridge_1 = require("../lib/security/bridge");
const input_1 = require("../lib/security/input");
const origins_1 = require("../lib/security/origins");
const policy_1 = require("../lib/security/policy");
const auth_1 = require("../lib/validators/auth");
function runSecurityInfrastructureTests() {
    const completedTests = [];
    strict_1.default.equal(policy_1.PLAIN_TEXT_ONLY_FIELDS.includes("tenant.organizationName"), true);
    const proxySurface = policy_1.SECURITY_HTTP_SURFACES.find((surface) => surface.id === "next.proxy.app-routes");
    const jwksSurface = policy_1.SECURITY_HTTP_SURFACES.find((surface) => surface.id === "convex.auth.jwks");
    strict_1.default.ok(proxySurface);
    strict_1.default.ok(jwksSurface);
    strict_1.default.equal(proxySurface.originEnforced, true);
    strict_1.default.equal(jwksSurface.originEnforced, false);
    strict_1.default.equal(policy_1.SECURITY_PROXY_AUDIT_ROUTE, "/api/internal/security-events/origin-blocked");
    completedTests.push("security scope metadata captures the in-scope proxy surface, public Convex metadata routes, and the internal audit bridge");
    strict_1.default.equal((0, input_1.normalizeAuthEmail)("  ADMIN@University.ac.ke "), "admin@university.ac.ke");
    strict_1.default.equal((0, input_1.normalizePlainText)("  University   of   Nairobi  "), "University of Nairobi");
    completedTests.push("shared input helpers normalize email casing and collapse plain-text whitespace deterministically");
    const validEmailResult = (0, input_1.validateEmailInput)("  Admin@University.ac.ke ");
    if (!validEmailResult.ok) {
        strict_1.default.fail("Expected normalized email validation to succeed");
    }
    strict_1.default.equal(validEmailResult.value, "admin@university.ac.ke");
    const invalidEmailResult = (0, input_1.validateEmailInput)("admin%3Cscript%3E@university.ac.ke");
    if (invalidEmailResult.ok) {
        strict_1.default.fail("Expected encoded markup email validation to fail");
    }
    strict_1.default.equal(invalidEmailResult.issue.outcome, audit_1.AUDIT_OUTCOMES.rejectedUnsafePlainText);
    completedTests.push("email validation normalizes valid values and rejects encoded markup payloads instead of silently mutating them");
    const validOrganizationResult = (0, input_1.validateOrganizationNameInput)("  University   of Nairobi  ");
    if (!validOrganizationResult.ok) {
        strict_1.default.fail("Expected organization validation to succeed");
    }
    strict_1.default.equal(validOrganizationResult.value.normalized, "University of Nairobi");
    strict_1.default.equal(validOrganizationResult.value.subdomain, "university-of-nairobi");
    const invalidOrganizationResult = (0, input_1.validateOrganizationNameInput)("&lt;script&gt;alert(1)&lt;/script&gt;");
    if (invalidOrganizationResult.ok) {
        strict_1.default.fail("Expected organization markup validation to fail");
    }
    strict_1.default.equal(invalidOrganizationResult.issue.outcome, audit_1.AUDIT_OUTCOMES.rejectedUnsafePlainText);
    const oversizedOrganizationResult = (0, input_1.validateOrganizationNameInput)("A".repeat(input_1.AUTH_INPUT_LIMITS.organizationName + 1));
    strict_1.default.equal(oversizedOrganizationResult.ok, false);
    completedTests.push("plain-text organization validation normalizes safe values and rejects unsafe or oversized input with deterministic failures");
    const verificationCodeResult = (0, input_1.validateOneTimeCodeInput)("12345678", {
        field: "code",
        label: "Verification code",
    });
    strict_1.default.equal(verificationCodeResult.ok, true);
    strict_1.default.equal((0, input_1.validateOneTimeCodeInput)("12<script>", {
        field: "code",
        label: "Reset code",
    }).ok, false);
    strict_1.default.equal((0, input_1.validatePasswordLength)("A".repeat(input_1.AUTH_INPUT_LIMITS.password + 1)).ok, false);
    completedTests.push("shared code and password guards reject malformed verification codes and oversized password inputs");
    strict_1.default.equal(auth_1.signupSchema.safeParse({
        email: "admin@university.ac.ke",
        organizationName: "University of Nairobi",
        password: "StrongPass#2026",
    }).success, true);
    strict_1.default.equal(auth_1.signupSchema.safeParse({
        email: "admin@university.ac.ke",
        organizationName: "<script>alert(1)</script>",
        password: "StrongPass#2026",
    }).success, false);
    strict_1.default.equal(auth_1.forgotPasswordSchema.safeParse({
        email: "admin%3Cscript%3E@university.ac.ke",
    }).success, false);
    strict_1.default.equal(auth_1.otpSchema.safeParse({ code: "12345678" }).success, true);
    strict_1.default.equal(auth_1.otpSchema.safeParse({ code: "12ab5678" }).success, false);
    strict_1.default.equal(auth_1.resetPasswordSchema.safeParse({
        email: "admin@university.ac.ke",
        code: "12345678",
        newPassword: "StrongPass#2026",
    }).success, true);
    completedTests.push("auth form schemas reuse the shared security validators for email, code, organization name, and password bounds");
    const developmentOrigins = (0, origins_1.resolveAllowedOrigins)({
        allowedOrigins: undefined,
        nodeEnv: "development",
    });
    strict_1.default.deepEqual(developmentOrigins.origins, [...origins_1.DEVELOPMENT_ALLOWED_ORIGINS]);
    const configuredOrigins = (0, origins_1.resolveAllowedOrigins)({
        allowedOrigins: " https://app.procureline.example , https://staging.procureline.example , https://app.procureline.example ",
        nodeEnv: "production",
    });
    strict_1.default.deepEqual(configuredOrigins.origins, [
        "https://app.procureline.example",
        "https://staging.procureline.example",
    ]);
    strict_1.default.throws(() => (0, origins_1.resolveAllowedOrigins)({
        allowedOrigins: undefined,
        nodeEnv: "production",
    }), origins_1.AllowedOriginsConfigurationError);
    completedTests.push("origin configuration uses development defaults locally and fails closed when production lacks an allowlist");
    strict_1.default.equal((0, bridge_1.resolveSecurityAuditProxyToken)({
        nodeEnv: "development",
        token: undefined,
    }), bridge_1.DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN);
    strict_1.default.equal((0, bridge_1.resolveSecurityAuditProxyToken)({
        nodeEnv: "production",
        token: "secure-proxy-token",
    }), "secure-proxy-token");
    strict_1.default.throws(() => (0, bridge_1.resolveSecurityAuditProxyToken)({
        nodeEnv: "production",
        token: undefined,
    }), bridge_1.SecurityAuditProxyConfigurationError);
    completedTests.push("blocked-origin audit forwarding uses a required server token outside development and a deterministic local default in development");
    const sameOriginDecision = (0, origins_1.evaluateOriginPolicy)({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: "https://app.procureline.example",
        path: "/dashboard",
        requestOrigin: "https://app.procureline.example",
    });
    strict_1.default.equal(sameOriginDecision.allowed, true);
    strict_1.default.equal(sameOriginDecision.reason, "allowed_same_origin");
    const allowlistedOriginDecision = (0, origins_1.evaluateOriginPolicy)({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: "https://staging.procureline.example",
        path: "/api/auth/session",
        requestOrigin: "https://app.procureline.example",
    });
    strict_1.default.equal(allowlistedOriginDecision.allowed, true);
    strict_1.default.equal(allowlistedOriginDecision.reason, "allowed_allowlisted_origin");
    const allowlistedNoOriginDecision = (0, origins_1.evaluateOriginPolicy)({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: null,
        path: "/api/auth/session",
        requestOrigin: "https://staging.procureline.example",
    });
    strict_1.default.equal(allowlistedNoOriginDecision.allowed, true);
    strict_1.default.equal(allowlistedNoOriginDecision.reason, "allowed_missing_origin_allowlisted_request");
    const safeNoOriginDecision = (0, origins_1.evaluateOriginPolicy)({
        allowedOrigins: configuredOrigins.origins,
        method: "GET",
        originHeader: null,
        path: "/login",
        requestOrigin: "https://app.procureline.example",
    });
    strict_1.default.equal(safeNoOriginDecision.allowed, true);
    strict_1.default.equal(safeNoOriginDecision.reason, "allowed_missing_origin_allowlisted_request");
    const trustedMissingOriginDecision = (0, origins_1.evaluateOriginPolicy)({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: null,
        path: "/tenant-admin",
        requestOrigin: "https://app.procureline.example",
    });
    strict_1.default.equal(trustedMissingOriginDecision.allowed, true);
    strict_1.default.equal(trustedMissingOriginDecision.reason, "allowed_missing_origin_allowlisted_request");
    const blockedMissingOriginDecision = (0, origins_1.evaluateOriginPolicy)({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: null,
        path: "/tenant-admin",
        requestOrigin: "https://evil.example",
    });
    strict_1.default.equal(blockedMissingOriginDecision.allowed, false);
    const blockedMissingOriginAuditEvent = blockedMissingOriginDecision.auditEvent;
    if (!blockedMissingOriginAuditEvent) {
        strict_1.default.fail("Expected a blocked missing-origin audit event");
    }
    strict_1.default.equal(blockedMissingOriginAuditEvent.outcome, audit_1.AUDIT_OUTCOMES.blockedMissingOrigin);
    strict_1.default.equal(blockedMissingOriginAuditEvent.actor.state, "anonymous");
    const blockedOriginDecision = (0, origins_1.evaluateOriginPolicy)({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: "https://evil.example",
        path: "/api/internal/security-events/origin-blocked",
        requestOrigin: "https://app.procureline.example",
    });
    strict_1.default.equal(blockedOriginDecision.allowed, false);
    const blockedOriginAuditEvent = blockedOriginDecision.auditEvent;
    if (!blockedOriginAuditEvent) {
        strict_1.default.fail("Expected a blocked-origin audit event");
    }
    strict_1.default.equal(blockedOriginAuditEvent.event, audit_1.AUDIT_EVENT_NAMES.securityOriginBlocked);
    completedTests.push("origin policy allows same-origin or allowlisted requests, permits safe no-Origin reads, and produces anonymous audit entries for blocked requests");
    const serializedAuditEvent = (0, audit_1.serializeAuditEvent)((0, audit_1.buildSecurityInputRejectedEvent)({
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "unassigned",
            userId: "user-123",
        }),
        field: "organizationName",
        flow: "registerWithTenant",
        outcome: audit_1.AUDIT_OUTCOMES.rejectedUnsafePlainText,
        path: "functions.users.registerWithTenant",
        reason: "encoded_or_markup_like_content",
    }));
    strict_1.default.equal(serializedAuditEvent.event, audit_1.AUDIT_EVENT_NAMES.securityInputRejected);
    strict_1.default.equal(serializedAuditEvent.actorState, "authenticated");
    strict_1.default.equal(serializedAuditEvent.actorRole, "unassigned");
    strict_1.default.equal(serializedAuditEvent.actorUserId, "user-123");
    completedTests.push("security audit serialization preserves stable event names plus authenticated and anonymous actor shapes");
    return completedTests;
}
exports.runSecurityInfrastructureTests = runSecurityInfrastructureTests;
